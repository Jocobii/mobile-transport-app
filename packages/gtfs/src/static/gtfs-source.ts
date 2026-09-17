import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";

/**
 * A GTFS static feed's tables, however they're stored
 * (zip archive, directory of .txt files, ...).
 */
export interface GtfsSource {
  hasFile(name: string): boolean;
  readRows(name: string): AsyncIterable<Record<string, string>>;
}

const UTF8_BOM = String.fromCharCode(0xfeff);

function stripBom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
}

function parseRows(text: string): Record<string, string>[] {
  return parse(stripBom(text), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

async function* toAsyncIterable(
  rows: Record<string, string>[],
): AsyncIterable<Record<string, string>> {
  for (const row of rows) {
    yield row;
  }
}

/** Reads a GTFS static feed from an in-memory zip archive (fflate). */
export function createZipGtfsSource(bytes: Uint8Array): GtfsSource {
  const entries = unzipSync(bytes);

  function fileNameFor(name: string): string | undefined {
    const fileName = `${name}.txt`;
    return fileName in entries ? fileName : undefined;
  }

  return {
    hasFile(name) {
      return fileNameFor(name) !== undefined;
    },
    readRows(name) {
      const fileName = fileNameFor(name);
      if (!fileName) {
        return toAsyncIterable([]);
      }
      const text = stripBom(Buffer.from(entries[fileName] as Uint8Array).toString("utf8"));
      return toAsyncIterable(parseRows(text));
    },
  };
}

/**
 * Reads a GTFS static feed from a directory of `.txt` files (fixtures,
 * `data/raw/<feed>/gtfs/`). */
export function createDirectoryGtfsSource(dirPath: string): GtfsSource {
  function filePathFor(name: string): string {
    return path.join(dirPath, `${name}.txt`);
  }

  return {
    hasFile(name) {
      return existsSync(filePathFor(name));
    },
    readRows(name) {
      const filePath = filePathFor(name);
      if (!existsSync(filePath)) {
        return toAsyncIterable([]);
      }
      const text = readFileSync(filePath, "utf8");
      return toAsyncIterable(parseRows(text));
    },
  };
}

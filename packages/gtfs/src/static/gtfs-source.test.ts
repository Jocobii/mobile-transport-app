import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createDirectoryGtfsSource, createZipGtfsSource } from "./gtfs-source";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test/fixtures/metrotransit/gtfs",
);

const BOM = String.fromCharCode(0xfeff);

async function collectRows(
  iterable: AsyncIterable<Record<string, string>>,
): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  for await (const row of iterable) rows.push(row);
  return rows;
}

/** Zips the fixture directory in memory so both sources can be compared against the same data. */
function zipFixtureDirectory(dirPath: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const entry of readdirSync(dirPath)) {
    files[entry] = readFileSync(path.join(dirPath, entry));
  }
  return zipSync(files);
}

describe("createDirectoryGtfsSource / createZipGtfsSource", () => {
  const zipBytes = zipFixtureDirectory(FIXTURE_DIR);
  const directorySource = createDirectoryGtfsSource(FIXTURE_DIR);
  const zipSource = createZipGtfsSource(zipBytes);

  it("hasFile agrees for a present and a missing table", () => {
    expect(directorySource.hasFile("routes")).toBe(true);
    expect(zipSource.hasFile("routes")).toBe(true);
    expect(directorySource.hasFile("frequencies")).toBe(false);
    expect(zipSource.hasFile("frequencies")).toBe(false);
  });

  it("both sources read identical rows for every fixture table", async () => {
    for (const table of ["agency", "routes", "trips", "stop_times", "stops", "shapes"]) {
      const fromDirectory = await collectRows(directorySource.readRows(table));
      const fromZip = await collectRows(zipSource.readRows(table));
      expect(fromZip).toEqual(fromDirectory);
      expect(fromDirectory.length).toBeGreaterThan(0);
    }
  });

  it("readRows returns an empty iterable for a table the feed does not have", async () => {
    expect(await collectRows(directorySource.readRows("frequencies"))).toEqual([]);
    expect(await collectRows(zipSource.readRows("frequencies"))).toEqual([]);
  });

  it("strips a UTF-8 BOM from a zip source", async () => {
    const csv = `${BOM}route_id,route_short_name\n1,54\n`;
    const bytes = zipSync({ "routes_bom.txt": new TextEncoder().encode(csv) });
    const rows = await collectRows(createZipGtfsSource(bytes).readRows("routes_bom"));
    expect(rows).toEqual([{ route_id: "1", route_short_name: "54" }]);
    expect(Object.keys(rows[0] as Record<string, string>)).toEqual([
      "route_id",
      "route_short_name",
    ]);
  });

  it("strips a UTF-8 BOM from a directory source too", async () => {
    const csv = `${BOM}route_id,route_short_name\n1,54\n`;
    const dir = mkdtempSync(path.join(tmpdir(), "gtfs-bom-"));
    try {
      writeFileSync(path.join(dir, "routes_bom.txt"), csv);
      const rows = await collectRows(createDirectoryGtfsSource(dir).readRows("routes_bom"));
      expect(rows).toEqual([{ route_id: "1", route_short_name: "54" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { ApiError } from "@transit/api-client";
import { describe, expect, it } from "vitest";
import { errorMessageKey } from "./error-message";

describe("errorMessageKey", () => {
  it("returns errors.accessDenied for an access_denied ApiError", () => {
    expect(errorMessageKey(new ApiError(403, "access_denied", "Access denied."))).toBe(
      "errors.accessDenied",
    );
  });

  it("returns common.error for any other ApiError", () => {
    expect(errorMessageKey(new ApiError(404, "not_found", "Not found."))).toBe("common.error");
    expect(errorMessageKey(new ApiError(500, "internal_error", "Oops."))).toBe("common.error");
  });

  it("returns common.error for a non-ApiError value", () => {
    expect(errorMessageKey(new Error("network down"))).toBe("common.error");
    expect(errorMessageKey(undefined)).toBe("common.error");
    expect(errorMessageKey("boom")).toBe("common.error");
  });
});

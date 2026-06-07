import { describe, expect, it } from "vitest";
import { extractBearerToken } from "../../src/descript/auth.js";

describe("extractBearerToken", () => {
  it("returns the bearer token from an Authorization header", () => {
    expect(extractBearerToken("Bearer dapi_example")).toBe("dapi_example");
  });

  it("trims surrounding whitespace around the header and token", () => {
    expect(extractBearerToken("  Bearer   dapi_trimmed  ")).toBe("dapi_trimmed");
  });

  it("rejects missing or non-bearer authorization", () => {
    expect(() => extractBearerToken(null)).toThrow(/Descript API token is missing/i);
    expect(() => extractBearerToken("Basic abc")).toThrow(/Bearer/i);
  });
});

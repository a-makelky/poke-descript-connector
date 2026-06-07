import { describe, expect, it } from "vitest";
import { DescriptApiError } from "../../src/descript/errors.js";

describe("DescriptApiError", () => {
  it("explains Drive-scoped 403 responses in plain language", () => {
    const error = new DescriptApiError(403, {
      message: "Project does not belong to the specified drive"
    });

    expect(error.summary).toContain("wrong Descript Drive");
    expect(error.warnings).toContain("Descript API tokens are scoped to one Drive.");
  });

  it("preserves retry-after guidance for rate limits", () => {
    const error = new DescriptApiError(429, { error: "rate_limited" }, "12");

    expect(error.summary).toContain("rate limit");
    expect(error.nextActions).toContain("Wait 12 seconds, then retry the request.");
  });
});

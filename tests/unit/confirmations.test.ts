import { describe, expect, it } from "vitest";
import { requireConfirmation } from "../../src/tools/confirmations.js";

describe("requireConfirmation", () => {
  it("allows a mutating operation when the expected confirmation is true", () => {
    expect(() => {
      requireConfirmation("confirm_edit", true);
    }).not.toThrow();
  });

  it("blocks a mutating operation without the expected confirmation", () => {
    expect(() => {
      requireConfirmation("confirm_publish", false);
    }).toThrow(/confirm_publish/);
    expect(() => {
      requireConfirmation("confirm_cancel", undefined);
    }).toThrow(/confirm_cancel/);
  });
});

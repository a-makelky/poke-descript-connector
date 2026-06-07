import { describe, expect, it } from "vitest";
import { diffProjectState } from "../../src/descript/qc.js";

describe("diffProjectState", () => {
  it("reports new compositions and preserved source composition", () => {
    const result = diffProjectState({
      beforeProject: {
        id: "project-1",
        compositions: [{ id: "source", name: "Source", duration: 100 }]
      },
      afterProject: {
        id: "project-1",
        compositions: [
          { id: "source", name: "Source", duration: 100 },
          { id: "clip-1", name: "Clip 1", duration: 42 }
        ]
      },
      sourceCompositionId: "source",
      expectedNewCompositionCount: 1,
      maxDurationSeconds: 60
    });

    expect(result.ok).toBe(true);
    expect(result.data.new_compositions).toHaveLength(1);
    expect(result.data.source_preserved).toBe(true);
  });

  it("warns when a new composition exceeds the expected maximum duration", () => {
    const result = diffProjectState({
      beforeProject: { id: "project-1", compositions: [] },
      afterProject: {
        id: "project-1",
        compositions: [{ id: "clip-1", name: "Long Clip", duration: 75 }]
      },
      maxDurationSeconds: 60
    });

    expect(result.ok).toBe(false);
    expect(result.warnings.join(" ")).toContain("Long Clip");
  });
});

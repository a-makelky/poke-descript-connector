import { describe, expect, it } from "vitest";
import {
  editWithUnderlordInputSchema,
  importMediaInputSchema,
  qcProjectChangesInputSchema,
  searchProjectsInputSchema,
  waitForJobInputSchema
} from "../../src/tools/schemas.js";

describe("tool input schemas", () => {
  it("accepts bounded project search filters", () => {
    const input = searchProjectsInputSchema.parse({
      name: "Demo",
      created_after: "2026-01-01T00:00:00Z",
      limit: 25,
      sort: "updated_at",
      direction: "desc"
    });

    expect(input.limit).toBe(25);
    expect(input.sort).toBe("updated_at");
  });

  it("rejects unsafe project search limits", () => {
    expect(() => searchProjectsInputSchema.parse({ limit: 0 })).toThrow();
    expect(() => searchProjectsInputSchema.parse({ limit: 101 })).toThrow();
  });

  it("requires imports to target an existing or new project", () => {
    expect(() =>
      importMediaInputSchema.parse({
        add_media: {
          "demo.mp4": { url: "https://example.com/demo.mp4" }
        }
      })
    ).toThrow(/project_id or project_name/);
  });

  it("accepts URL imports and direct-upload URL requests", () => {
    const urlImport = importMediaInputSchema.parse({
      project_name: "URL Import",
      add_media: {
        "demo.mp4": { url: "https://example.com/demo.mp4" }
      }
    });
    const uploadRequest = importMediaInputSchema.parse({
      project_name: "Upload Request",
      add_media: {
        "demo.mp4": { content_type: "video/mp4", file_size: 1024 }
      }
    });

    expect(urlImport.add_media["demo.mp4"]?.url).toBe("https://example.com/demo.mp4");
    expect(uploadRequest.add_media["demo.mp4"]?.file_size).toBe(1024);
  });

  it("rejects incomplete direct-upload media entries", () => {
    expect(() =>
      importMediaInputSchema.parse({
        project_name: "Broken Upload",
        add_media: {
          "demo.mp4": { content_type: "video/mp4" }
        }
      })
    ).toThrow(/url or content_type plus file_size/);
  });

  it("requires Underlord edits to include a prompt and project identity", () => {
    expect(() => editWithUnderlordInputSchema.parse({ project_id: "project-1" })).toThrow();
    expect(() => editWithUnderlordInputSchema.parse({ prompt: "Add captions" })).toThrow(
      /project_id or project_name/
    );

    const input = editWithUnderlordInputSchema.parse({
      project_id: "project-1",
      prompt: "Add captions"
    });
    expect(input.prompt).toBe("Add captions");
  });

  it("applies wait-for-job polling defaults", () => {
    const input = waitForJobInputSchema.parse({ job_id: "job-1" });

    expect(input.timeout_seconds).toBe(120);
    expect(input.poll_interval_seconds).toBe(5);
  });

  it("accepts minimal before/after QC snapshots", () => {
    const input = qcProjectChangesInputSchema.parse({
      before_project: { id: "project-1" },
      after_project: { id: "project-1", compositions: [{ id: "clip-1", name: "Clip 1" }] }
    });

    expect(input.after_project.compositions).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { callDescriptToolForTest } from "../../src/tools/registry.js";
import type { Fetcher } from "../../src/descript/types.js";

describe("Descript MCP tool handlers", () => {
  it("returns the standard response shape from a read-only tool", async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(
        Response.json({
          data: [{ id: "project-1", name: "Demo", folder_path: "Examples" }],
          pagination: {}
        })
      )
    );

    const result = await callDescriptToolForTest("descript_search_projects", {
      input: { name: "Demo" },
      token: "dapi_user",
      apiBase: "https://descriptapi.test/v1",
      fetcher
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("project");
    expect(result.data).toMatchObject({ count: 1 });
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.next_actions)).toBe(true);
  });

  it("blocks Underlord edits unless confirm_edit is true", async () => {
    const result = await callDescriptToolForTest("descript_edit_with_underlord", {
      input: { project_id: "project-1", prompt: "Add captions" },
      token: "dapi_user",
      apiBase: "https://descriptapi.test/v1",
      fetcher: vi.fn()
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/confirm_edit/);
  });

  it("returns a tool-shaped error when a Descript tool is called without a token", async () => {
    const result = await callDescriptToolForTest("descript_search_projects", {
      input: { limit: 1 },
      apiBase: "https://descriptapi.test/v1",
      fetcher: vi.fn()
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/Descript API token is missing/i);
    expect(result.next_actions).toContain(
      "Add a Descript API token to the Poke integration and retry this tool."
    );
  });
});

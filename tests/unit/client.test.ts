import { describe, expect, it, vi } from "vitest";
import { DescriptClient } from "../../src/descript/client.js";
import type { Fetcher } from "../../src/descript/types.js";

describe("DescriptClient", () => {
  it("sends the user's Descript token as a bearer token", async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(Response.json({ id: "project-1" })));
    const client = new DescriptClient({
      apiBase: "https://descriptapi.test/v1",
      token: "dapi_user",
      fetcher
    });

    await client.getProject("project-1");

    const request = fetcher.mock.calls[0]![0];
    expect(request.headers.get("Authorization")).toBe("Bearer dapi_user");
    expect(request.url).toBe("https://descriptapi.test/v1/projects/project-1");
  });

  it("turns non-ok API responses into DescriptApiError", async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(Response.json({ message: "Unauthorized" }, { status: 401 }))
    );
    const client = new DescriptClient({
      apiBase: "https://descriptapi.test/v1",
      token: "bad",
      fetcher
    });

    await expect(client.getProject("project-1")).rejects.toThrow(/Unauthorized/);
  });
});

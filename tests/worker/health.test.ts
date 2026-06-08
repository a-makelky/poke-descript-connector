import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

type HealthResponse = {
  ok: boolean;
  service: string;
};

type InitializeResponse = {
  result: {
    serverInfo: {
      name: string;
    };
    instructions?: string;
  };
};

type ToolsListResponse = {
  result: {
    tools: { name: string }[];
  };
};

type ToolCallResponse = {
  result: {
    content: { type: string; text: string }[];
    isError?: boolean;
    structuredContent?: {
      ok: boolean;
      summary: string;
    };
  };
};

type WorkerExports = {
  default: {
    fetch: (request: Request) => Promise<Response> | Response;
  };
};

const workerExports = exports as unknown as WorkerExports;

describe("Worker public endpoints", () => {
  it("returns health information", async () => {
    const response = await fetchWorker(new Request("https://example.com/health"));
    const body = await response.json<HealthResponse>();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, service: "poke-descript-connector" });
  });

  it("exposes Descript tools through the MCP endpoint", async () => {
    const initialize = await callMcp<InitializeResponse>({
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "worker-test", version: "0.1.0" }
      }
    });

    expect(initialize.result.serverInfo.name).toBe("poke-descript-connector");
    expect(initialize.result.instructions).toContain("confirm_import");
    expect(initialize.result.instructions).toContain("Descript API tokens are scoped to one Drive");

    const tools = await callMcp<ToolsListResponse>({
      id: 2,
      method: "tools/list",
      params: {}
    });

    const toolNames = tools.result.tools.map((tool) => tool.name);
    expect(toolNames).toContain("descript_search_projects");
    expect(toolNames).toContain("descript_edit_with_underlord");
  });

  it("allows MCP discovery before a Descript token is attached", async () => {
    const initialize = await callMcp<InitializeResponse>(
      {
        id: 10,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "worker-test", version: "0.1.0" }
        }
      },
      { authorization: false }
    );

    expect(initialize.result.serverInfo.name).toBe("poke-descript-connector");

    const tools = await callMcp<ToolsListResponse>(
      {
        id: 11,
        method: "tools/list",
        params: {}
      },
      { authorization: false }
    );

    const toolNames = tools.result.tools.map((tool) => tool.name);
    expect(toolNames).toContain("descript_search_projects");
  });

  it("returns a clear tool error when Descript is called without a token", async () => {
    const result = await callMcp<ToolCallResponse>(
      {
        id: 12,
        method: "tools/call",
        params: {
          name: "descript_search_projects",
          arguments: { limit: 1 }
        }
      },
      { authorization: false }
    );

    expect(result.result.isError).toBe(true);
    expect(result.result.structuredContent?.ok).toBe(false);
    expect(result.result.structuredContent?.summary).toMatch(/Descript API token is missing/i);
  });

  it("requires confirmation before requesting Descript upload URLs", async () => {
    const response = await fetchWorker(
      new Request("https://example.com/api/descript/upload-urls", {
        method: "POST",
        headers: {
          Authorization: "Bearer dapi_test",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project_name: "Missing Confirmation",
          add_media: {
            "demo.mp4": {
              content_type: "video/mp4",
              file_size: 1024
            }
          }
        })
      })
    );

    const body = await response.json<{ ok: boolean; summary: string }>();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.summary).toContain("confirm_import");
  });

  it("requires a Descript token before polling browser upload jobs", async () => {
    const response = await fetchWorker(
      new Request("https://example.com/api/descript/jobs/job_123")
    );

    const body = await response.json<{ ok: boolean; summary: string }>();
    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.summary).toMatch(/Descript API token is missing/i);
  });

  it("rejects non-GET browser upload job polling requests", async () => {
    const response = await fetchWorker(
      new Request("https://example.com/api/descript/jobs/job_123", {
        method: "POST",
        headers: { Authorization: "Bearer dapi_test" }
      })
    );

    const body = await response.json<{ error: string }>();
    expect(response.status).toBe(405);
    expect(body.error).toBe("Method not allowed");
  });

  it("requires a Descript token before proxying browser uploads", async () => {
    const response = await fetchWorker(
      new Request("https://example.com/api/descript/upload-proxy", {
        method: "POST",
        headers: {
          "X-Descript-Upload-Url": "https://storage.googleapis.com/descript-upload/demo"
        },
        body: "demo"
      })
    );

    const body = await response.json<{ ok: boolean; summary: string }>();
    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.summary).toMatch(/Descript API token is missing/i);
  });

  it("rejects browser upload proxy requests for unsupported upload hosts", async () => {
    const response = await fetchWorker(
      new Request("https://example.com/api/descript/upload-proxy", {
        method: "POST",
        headers: {
          Authorization: "Bearer dapi_test",
          "X-Descript-Upload-Url": "https://example.com/upload"
        },
        body: "demo"
      })
    );

    const body = await response.json<{ ok: boolean; summary: string }>();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.summary).toContain("unsupported upload host");
  });
});

async function callMcp<TResponse>(
  message: Record<string, unknown>,
  options: { authorization?: boolean } = {}
): Promise<TResponse> {
  const headers = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  });
  if (options.authorization !== false) {
    headers.set("Authorization", "Bearer dapi_test");
  }

  const response = await fetchWorker(
    new Request("https://example.com/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", ...message })
    })
  );

  expect(response.status).toBe(200);
  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as TResponse;
  }

  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error(`No MCP data line found in response: ${text}`);
  return JSON.parse(dataLine.slice("data: ".length)) as TResponse;
}

async function fetchWorker(request: Request): Promise<Response> {
  return workerExports.default.fetch(request);
}

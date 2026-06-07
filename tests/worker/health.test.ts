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
  };
};

type ToolsListResponse = {
  result: {
    tools: { name: string }[];
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

    const tools = await callMcp<ToolsListResponse>({
      id: 2,
      method: "tools/list",
      params: {}
    });

    const toolNames = tools.result.tools.map((tool) => tool.name);
    expect(toolNames).toContain("descript_search_projects");
    expect(toolNames).toContain("descript_edit_with_underlord");
  });
});

async function callMcp<TResponse>(message: Record<string, unknown>): Promise<TResponse> {
  const response = await fetchWorker(
    new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer dapi_test",
        "Content-Type": "application/json"
      },
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

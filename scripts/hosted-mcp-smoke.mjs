const baseUrl =
  process.env.CONNECTOR_BASE_URL ?? "https://poke-descript-connector.aaron-345.workers.dev";
const token = process.env.DESCRIPT_API_TOKEN ?? "dapi_smoke_test";
const expectedTools = [
  "descript_search_projects",
  "descript_get_project",
  "descript_import_media",
  "descript_edit_with_underlord",
  "descript_export_transcript",
  "descript_publish_media",
  "descript_get_job",
  "descript_wait_for_job",
  "descript_cancel_job",
  "descript_qc_project_changes"
];

const health = await fetchJson(`${baseUrl}/health`);
assert(health.ok === true, "Health endpoint did not return ok: true.");

const initialize = await callMcp("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "poke-descript-hosted-smoke", version: "0.1.0" }
});
assert(
  initialize.result?.serverInfo?.name === "poke-descript-connector",
  "MCP initialize did not identify the connector."
);

const tools = await callMcp("tools/list", {});
const toolNames = tools.result?.tools?.map((tool) => tool.name) ?? [];
for (const tool of expectedTools) {
  assert(toolNames.includes(tool), `Missing MCP tool: ${tool}`);
}

const readOnlyLive =
  process.env.LIVE_READONLY_DESCRIPT_TESTS === "true" && process.env.DESCRIPT_API_TOKEN;
let liveSearch = null;
if (readOnlyLive) {
  const result = await callMcp("tools/call", {
    name: "descript_search_projects",
    arguments: { limit: 1 }
  });
  liveSearch = parseToolResponse(result);
  assert(liveSearch.ok === true, `Live read-only Descript search failed: ${liveSearch.summary}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      toolCount: toolNames.length,
      expectedToolsPresent: true,
      liveReadOnlyDescriptSearch: liveSearch
        ? {
            ok: liveSearch.ok,
            summary: liveSearch.summary,
            count: liveSearch.data?.count
          }
        : "skipped"
    },
    null,
    2
  )
);

async function callMcp(method, params) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Poke-User-Id": "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1_000_000),
      method,
      params
    })
  });

  assert(response.ok, `MCP ${method} returned HTTP ${response.status}.`);
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? JSON.parse(text) : parseSse(text);
  if (body.error) throw new Error(`MCP ${method} error: ${JSON.stringify(body.error)}`);
  return body;
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert(response.ok, `${url} returned HTTP ${response.status}.`);
  return response.json();
}

function parseSse(text) {
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error(`No SSE data line found: ${text}`);
  return JSON.parse(dataLine.slice("data: ".length));
}

function parseToolResponse(result) {
  const text = result.result?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`No tool response text found: ${JSON.stringify(result)}`);
  return JSON.parse(text);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

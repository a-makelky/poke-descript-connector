import { createMcpHandler } from "agents/mcp";
import { DescriptClient } from "./descript/client.js";
import { extractBearerToken, extractOptionalBearerToken } from "./descript/auth.js";
import { createDescriptMcpServer } from "./mcp/server.js";
import { asJsonValue, type JsonObject } from "./shared/json.js";
import { requestUploadUrlsInputSchema } from "./tools/schemas.js";
import { requireConfirmation } from "./tools/confirmations.js";
import { toolResponse } from "./tools/response.js";
import { errorResponse, jsonResponse } from "./http/responses.js";

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_UPLOAD_RESPONSE_BODY_BYTES = 64_000;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "poke-descript-connector" });
    }

    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, env, ctx);
    }

    if (url.pathname === "/api/descript/upload-urls") {
      return handleUploadUrlsRequest(request, env);
    }

    if (url.pathname === "/api/descript/upload-proxy") {
      return handleUploadProxyRequest(request);
    }

    const descriptJobId = getDescriptJobId(url);
    if (descriptJobId) {
      return handleJobStatusRequest(request, env, descriptJobId);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;

async function handleMcpRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const token = extractOptionalBearerToken(request.headers.get("Authorization"));
    const options = { apiBase: env.DESCRIPT_API_BASE, ...(token ? { token } : {}) };
    const server = createDescriptMcpServer(options);
    const handler = createMcpHandler(server, {
      route: "/mcp",
      enableJsonResponse: false
    });
    return await handler(request, env, ctx);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleUploadUrlsRequest(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    const contentLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
    if (contentLength > MAX_JSON_BODY_BYTES) {
      return jsonResponse({ error: "Request body too large" }, { status: 413 });
    }

    const token = extractBearerToken(request.headers.get("Authorization"));
    const input = requestUploadUrlsInputSchema.parse(await request.json());
    requireConfirmation("confirm_import", input.confirm_import);
    const body = { ...input };
    delete body.confirm_import;
    const client = new DescriptClient({ apiBase: env.DESCRIPT_API_BASE, token });
    const job = await client.importMedia(asJsonValue(body) as JsonObject);

    return jsonResponse(
      toolResponse({
        ok: true,
        summary:
          "Descript upload URLs created. Upload file bytes directly to the returned signed URLs.",
        data: asJsonValue(job) as JsonObject,
        warnings: [],
        next_actions: [
          "PUT each local file directly to its upload_url.",
          "Use descript_wait_for_job with the returned job_id after uploads finish."
        ]
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleUploadProxyRequest(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    extractBearerToken(request.headers.get("Authorization"));

    const uploadUrlValue = request.headers.get("X-Descript-Upload-Url");
    if (!uploadUrlValue) {
      return badRequest("Descript upload proxy is missing the signed upload URL.");
    }

    let uploadUrl: URL;
    try {
      uploadUrl = new URL(uploadUrlValue);
    } catch {
      return badRequest("Descript upload proxy received an invalid signed upload URL.");
    }

    if (uploadUrl.protocol !== "https:" || !isAllowedDescriptUploadHost(uploadUrl.hostname)) {
      return badRequest("Descript upload proxy received an unsupported upload host.", {
        host: uploadUrl.hostname
      });
    }

    if (!request.body) {
      return badRequest("Descript upload proxy received an empty file body.");
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: request.body
    });
    const responseBody = await readLimitedText(uploadResponse, MAX_UPLOAD_RESPONSE_BODY_BYTES);

    if (!uploadResponse.ok) {
      return jsonResponse(
        toolResponse({
          ok: false,
          summary: `Descript signed upload returned HTTP ${String(uploadResponse.status)}.`,
          data: {
            status: uploadResponse.status,
            body: responseBody
          },
          warnings: [],
          next_actions: ["Request a fresh upload URL and retry the original local file."]
        }),
        { status: 502 }
      );
    }

    return jsonResponse(
      toolResponse({
        ok: true,
        summary: "File uploaded to Descript through the Worker relay.",
        data: {
          upload_status: uploadResponse.status,
          upload_response: responseBody
        },
        warnings: [],
        next_actions: ["Poll the Descript import job."]
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function badRequest(summary: string, data: JsonObject = {}): Response {
  return jsonResponse(
    toolResponse({
      ok: false,
      summary,
      data,
      warnings: [],
      next_actions: []
    }),
    { status: 400 }
  );
}

function isAllowedDescriptUploadHost(hostname: string): boolean {
  return hostname === "storage.googleapis.com" || hostname.endsWith(".storage.googleapis.com");
}

function getDescriptJobId(url: URL): string | null {
  const match = /^\/api\/descript\/jobs\/([^/]+)$/.exec(url.pathname);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

async function handleJobStatusRequest(
  request: Request,
  env: Env,
  jobId: string
): Promise<Response> {
  try {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    const token = extractBearerToken(request.headers.get("Authorization"));
    const client = new DescriptClient({ apiBase: env.DESCRIPT_API_BASE, token });
    const job = await client.getJob(jobId);

    return jsonResponse(
      toolResponse({
        ok: true,
        summary: `Descript job ${jobId} status fetched.`,
        data: asJsonValue(job) as JsonObject,
        warnings: [],
        next_actions: []
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return `${text}${decoder.decode(value, { stream: true })}`.slice(0, maxBytes);
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

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

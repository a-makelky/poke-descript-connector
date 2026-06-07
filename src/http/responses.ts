import { MissingDescriptTokenError } from "../descript/auth.js";
import { DescriptApiError } from "../descript/errors.js";
import { asJsonValue } from "../shared/json.js";
import { ConfirmationRequiredError } from "../tools/confirmations.js";
import { toolResponse } from "../tools/response.js";

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof MissingDescriptTokenError) {
    return jsonResponse(
      toolResponse({
        ok: false,
        summary: error.message,
        data: {},
        warnings: [],
        next_actions: ["Create a Descript API token and add it to the Poke integration."]
      }),
      { status: 401 }
    );
  }

  if (error instanceof DescriptApiError) {
    return jsonResponse(
      toolResponse({
        ok: false,
        summary: error.summary,
        data: { status: error.status, body: error.body },
        warnings: error.warnings,
        next_actions: error.nextActions
      }),
      { status: error.status }
    );
  }

  if (error instanceof ConfirmationRequiredError) {
    return jsonResponse(
      toolResponse({
        ok: false,
        summary: error.message,
        data: {},
        warnings: [],
        next_actions: [
          "Add the required confirmation field only when the user clearly wants this action."
        ]
      }),
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Unknown connector error.";
  return jsonResponse(
    toolResponse({
      ok: false,
      summary: message,
      data: { error: asJsonValue(error) },
      warnings: [],
      next_actions: []
    }),
    { status: 500 }
  );
}

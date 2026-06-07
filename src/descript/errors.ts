import { asJsonValue, isJsonObject, type JsonValue } from "../shared/json.js";

function bodyMessage(body: unknown): string {
  if (typeof body === "string") return body;
  if (isJsonObject(body)) {
    const message = body.message ?? body.error;
    if (typeof message === "string") return message;
  }
  return JSON.stringify(asJsonValue(body));
}

export class DescriptApiError extends Error {
  readonly status: number;
  readonly body: JsonValue;
  readonly retryAfter: string | null;
  readonly summary: string;
  readonly warnings: string[];
  readonly nextActions: string[];

  constructor(status: number, body: unknown, retryAfter: string | null = null) {
    const message = bodyMessage(body);
    super(`Descript API ${String(status)}: ${message}`);
    this.name = "DescriptApiError";
    this.status = status;
    this.body = asJsonValue(body);
    this.retryAfter = retryAfter;
    this.summary = summarizeStatus(status, message);
    this.warnings = warningsForStatus(status, message);
    this.nextActions = nextActionsForStatus(status, retryAfter);
  }
}

function summarizeStatus(status: number, message: string): string {
  if (status === 401) return "Descript rejected the API token.";
  if (status === 403 && /drive/i.test(message)) {
    return "Descript rejected the request because the token is probably for the wrong Descript Drive.";
  }
  if (status === 403) return "Descript says this token does not have access to that resource.";
  if (status === 404)
    return "Descript could not find that project, job, composition, or published item.";
  if (status === 429) return "Descript hit a rate limit.";
  if (status >= 500) return "Descript returned a server error.";
  return `Descript returned HTTP ${String(status)}.`;
}

function warningsForStatus(status: number, message: string): string[] {
  const warnings: string[] = [];
  if (status === 403 && /drive/i.test(message)) {
    warnings.push("Descript API tokens are scoped to one Drive.");
    warnings.push("A valid token can still fail when the project belongs to a different Drive.");
  }
  if (status === 402) {
    warnings.push("The Descript account may be out of credits or media minutes.");
  }
  return warnings;
}

function nextActionsForStatus(status: number, retryAfter: string | null): string[] {
  if (status === 401)
    return ["Create a fresh Descript API token and reconnect the Poke integration."];
  if (status === 403) {
    return ["Confirm the Descript token was created for the same Drive as the target project."];
  }
  if (status === 429) {
    return retryAfter
      ? [`Wait ${retryAfter} seconds, then retry the request.`]
      : ["Wait, then retry the request."];
  }
  return [];
}

import { DescriptApiError } from "./errors.js";
import type {
  AgentEditRequest,
  ExportTranscriptRequest,
  Fetcher,
  ImportMediaRequest,
  JobResponse,
  ListProjectsResponse,
  ProjectDetails,
  PublishMediaRequest
} from "./types.js";

type DescriptClientOptions = {
  apiBase: string;
  token: string;
  fetcher?: Fetcher;
};

type QueryValue = string | number | boolean | undefined;

const DEFAULT_TEXT_LIMIT_BYTES = 2_000_000;

export class DescriptClient {
  private readonly apiBase: string;
  private readonly token: string;
  private readonly fetcher: Fetcher;

  constructor(options: DescriptClientOptions) {
    this.apiBase = options.apiBase.replace(/\/$/, "");
    this.token = options.token;
    this.fetcher = options.fetcher ?? fetch;
  }

  async listProjects(query: Record<string, QueryValue> = {}): Promise<ListProjectsResponse> {
    return this.requestJson<ListProjectsResponse>(`/projects${toQueryString(query)}`);
  }

  async getProject(projectId: string): Promise<ProjectDetails> {
    return this.requestJson<ProjectDetails>(`/projects/${encodeURIComponent(projectId)}`);
  }

  async importMedia(body: ImportMediaRequest): Promise<JobResponse> {
    return this.requestJson<JobResponse>("/jobs/import/project_media", {
      method: "POST",
      body
    });
  }

  async agentEdit(body: AgentEditRequest): Promise<JobResponse> {
    return this.requestJson<JobResponse>("/jobs/agent", {
      method: "POST",
      body
    });
  }

  async publishMedia(body: PublishMediaRequest): Promise<JobResponse> {
    return this.requestJson<JobResponse>("/jobs/publish", {
      method: "POST",
      body
    });
  }

  async exportTranscript(body: ExportTranscriptRequest): Promise<{
    transcript: string;
    compositionId: string | null;
    contentType: string;
  }> {
    const response = await this.requestRaw("/export/transcript", {
      method: "POST",
      body
    });

    return {
      transcript: await readLimitedText(response, DEFAULT_TEXT_LIMIT_BYTES),
      compositionId: response.headers.get("X-Composition-Id"),
      contentType: response.headers.get("Content-Type") ?? "text/plain"
    };
  }

  async listJobs(query: Record<string, QueryValue> = {}): Promise<unknown> {
    return this.requestJson(`/jobs${toQueryString(query)}`);
  }

  async getJob(jobId: string): Promise<JobResponse> {
    return this.requestJson<JobResponse>(`/jobs/${encodeURIComponent(jobId)}`);
  }

  async cancelJob(jobId: string): Promise<{ canceled: true; job_id: string }> {
    await this.requestRaw(`/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    return { canceled: true, job_id: jobId };
  }

  async getPublishedProjectMetadata(publishedProjectSlug: string): Promise<unknown> {
    return this.requestJson(`/published_projects/${encodeURIComponent(publishedProjectSlug)}`);
  }

  private async requestJson<T = unknown>(
    path: string,
    init: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const response = await this.requestRaw(path, init);
    if (response.status === 204) return null as T;
    return response.json();
  }

  private async requestRaw(
    path: string,
    init: { method?: string; body?: unknown } = {}
  ): Promise<Response> {
    const headers = new Headers({
      Authorization: `Bearer ${this.token}`
    });

    let body: BodyInit | undefined;
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }

    const requestInit: RequestInit = {
      method: init.method ?? "GET",
      headers
    };
    if (body !== undefined) requestInit.body = body;

    const request = new Request(`${this.apiBase}${path}`, requestInit);

    const response = await this.fetcher(request);
    if (!response.ok) {
      throw new DescriptApiError(
        response.status,
        await readErrorBody(response),
        response.headers.get("Retry-After")
      );
    }

    return response;
  }
}

function toQueryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return readLimitedText(response, 64_000);
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
      throw new Error(`Response body exceeded ${String(maxBytes)} bytes.`);
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

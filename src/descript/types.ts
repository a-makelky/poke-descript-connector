import type { JsonObject, JsonValue } from "../shared/json.js";

export type Fetcher = (request: Request) => Promise<Response>;

export type ProjectSummary = {
  id: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  folder_path?: string;
};

export type CompositionSummary = {
  id: string;
  name: string;
  duration?: number;
  media_type?: string;
  type?: string;
};

export type ProjectDetails = ProjectSummary & {
  drive_id?: string;
  media_files?: JsonObject;
  compositions?: CompositionSummary[];
};

export type ListProjectsResponse = {
  data: ProjectSummary[];
  pagination?: {
    next_cursor?: string;
  };
};

export type JobResponse = JsonObject & {
  job_id: string;
  job_type?: string;
  job_state?: string;
  project_id?: string;
  project_url?: string;
  result?: JsonObject;
  progress?: {
    label?: string;
    last_update_at?: string;
  };
};

export type ImportMediaRequest = JsonObject;
export type AgentEditRequest = JsonObject;
export type PublishMediaRequest = JsonObject;
export type ExportTranscriptRequest = JsonObject;
export type JsonRecord = Record<string, JsonValue>;

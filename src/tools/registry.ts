import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { MissingDescriptTokenError } from "../descript/auth.js";
import { DescriptClient } from "../descript/client.js";
import { DescriptApiError } from "../descript/errors.js";
import { diffProjectState, type ProjectDiffInput } from "../descript/qc.js";
import type {
  CompositionSummary,
  Fetcher,
  JobResponse,
  ProjectDetails
} from "../descript/types.js";
import { asJsonValue, type JsonObject } from "../shared/json.js";
import { requireConfirmation, ConfirmationRequiredError } from "./confirmations.js";
import { toolResponse, toCallToolResult, type ToolResponse } from "./response.js";
import {
  cancelJobInputSchema,
  editWithUnderlordInputSchema,
  exportTranscriptInputSchema,
  getJobInputSchema,
  getProjectInputSchema,
  importMediaInputSchema,
  publishMediaInputSchema,
  qcProjectChangesInputSchema,
  searchProjectsInputSchema,
  waitForJobInputSchema,
  type CancelJobInput,
  type EditWithUnderlordInput,
  type ExportTranscriptInput,
  type GetJobInput,
  type GetProjectInput,
  type ImportMediaInput,
  type PublishMediaInput,
  type QcProjectChangesInput,
  type SearchProjectsInput,
  type WaitForJobInput
} from "./schemas.js";

type ToolContext = {
  apiBase: string;
  token?: string;
  fetcher?: Fetcher;
};

type TestToolCall = ToolContext & {
  input: unknown;
};

type ToolName =
  | "descript_search_projects"
  | "descript_get_project"
  | "descript_import_media"
  | "descript_edit_with_underlord"
  | "descript_export_transcript"
  | "descript_publish_media"
  | "descript_get_job"
  | "descript_wait_for_job"
  | "descript_cancel_job"
  | "descript_qc_project_changes";

type ToolDefinition<TInput> = {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: ToolContext) => Promise<ToolResponse> | ToolResponse;
};

export function registerDescriptTools(server: McpServer, context: ToolContext): void {
  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema
      },
      async (input: unknown) => {
        const response = await executeSafely(tool, input, context);
        return toCallToolResult(response);
      }
    );
  }
}

export async function callDescriptToolForTest(
  name: ToolName,
  call: TestToolCall
): Promise<ToolResponse> {
  const tool = toolDefinitions.find((definition) => definition.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return executeSafely(tool, call.input, call);
}

async function executeSafely(
  tool: ToolDefinition<unknown>,
  input: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    return await tool.execute(input, context);
  } catch (error) {
    return errorToToolResponse(error);
  }
}

function client(context: ToolContext): DescriptClient {
  if (!context.token) {
    throw new MissingDescriptTokenError();
  }

  const options = {
    apiBase: context.apiBase,
    token: context.token
  };
  return context.fetcher
    ? new DescriptClient({ ...options, fetcher: context.fetcher })
    : new DescriptClient(options);
}

const toolDefinitions: ToolDefinition<unknown>[] = [
  {
    name: "descript_search_projects",
    title: "Search Descript Projects",
    description: "List Descript projects visible to the user's Drive-scoped token.",
    inputSchema: searchProjectsInputSchema,
    execute: async (rawInput, context) => {
      const input = searchProjectsInputSchema.parse(rawInput) satisfies SearchProjectsInput;
      const result = await client(context).listProjects(input);
      const count = result.data.length;
      return toolResponse({
        ok: true,
        summary: `Found ${String(count)} Descript project${count === 1 ? "" : "s"}.`,
        data: {
          count,
          projects: asJsonValue(result.data),
          pagination: asJsonValue(result.pagination ?? {})
        },
        warnings: [],
        next_actions:
          count === 0
            ? [
                "Try a broader name search or confirm the token belongs to the expected Descript Drive."
              ]
            : ["Use descript_get_project with a project_id to inspect media and compositions."]
      });
    }
  },
  {
    name: "descript_get_project",
    title: "Get Descript Project",
    description: "Fetch project details, including media files and compositions.",
    inputSchema: getProjectInputSchema,
    execute: async (rawInput, context) => {
      const input = getProjectInputSchema.parse(rawInput) satisfies GetProjectInput;
      const project = await client(context).getProject(input.project_id);
      const projectName = project.name ?? input.project_id;
      return toolResponse({
        ok: true,
        summary: `Loaded Descript project ${projectName}.`,
        data: asJsonValue(project) as JsonObject,
        warnings: [],
        next_actions: [
          "Use composition IDs from this response for edits, transcript export, or publish jobs."
        ]
      });
    }
  },
  {
    name: "descript_import_media",
    title: "Import Media Into Descript",
    description:
      "Create or update a project by importing media from URLs or requesting upload URLs.",
    inputSchema: importMediaInputSchema,
    execute: async (rawInput, context) => {
      const input = importMediaInputSchema.parse(rawInput) satisfies ImportMediaInput;
      requireConfirmation("confirm_import", input.confirm_import);
      const { confirm_import: _confirmImport, ...body } = input;
      const job = await client(context).importMedia(asJsonValue(body) as JsonObject);
      return jobResponse("Descript import job started.", job);
    }
  },
  {
    name: "descript_edit_with_underlord",
    title: "Edit With Underlord",
    description: "Ask Descript's Agent Underlord to create or edit a project.",
    inputSchema: editWithUnderlordInputSchema,
    execute: async (rawInput, context) => {
      const input = editWithUnderlordInputSchema.parse(rawInput) satisfies EditWithUnderlordInput;
      requireConfirmation("confirm_edit", input.confirm_edit);
      const { confirm_edit: _confirmEdit, ...body } = input;
      const job = await client(context).agentEdit(asJsonValue(body) as JsonObject);
      return jobResponse("Descript Underlord edit job started.", job);
    }
  },
  {
    name: "descript_export_transcript",
    title: "Export Descript Transcript",
    description:
      "Export a project or composition transcript as text, Markdown, HTML, RTF, or DOCX.",
    inputSchema: exportTranscriptInputSchema,
    execute: async (rawInput, context) => {
      const input = exportTranscriptInputSchema.parse(rawInput) satisfies ExportTranscriptInput;
      const result = await client(context).exportTranscript(asJsonValue(input) as JsonObject);
      return toolResponse({
        ok: true,
        summary: `Exported transcript as ${input.format}.`,
        data: {
          transcript: result.transcript,
          composition_id: result.compositionId,
          content_type: result.contentType
        },
        warnings: [],
        next_actions: ["Use the transcript for summaries, show notes, clip planning, or QA."]
      });
    }
  },
  {
    name: "descript_publish_media",
    title: "Publish Descript Media",
    description: "Start a Descript publish/export job for a composition.",
    inputSchema: publishMediaInputSchema,
    execute: async (rawInput, context) => {
      const input = publishMediaInputSchema.parse(rawInput) satisfies PublishMediaInput;
      requireConfirmation("confirm_publish", input.confirm_publish);
      const { confirm_publish: _confirmPublish, ...body } = input;
      const job = await client(context).publishMedia(asJsonValue(body) as JsonObject);
      return jobResponse("Descript publish job started.", job);
    }
  },
  {
    name: "descript_get_job",
    title: "Get Descript Job",
    description: "Retrieve the current status of a Descript import, edit, or publish job.",
    inputSchema: getJobInputSchema,
    execute: async (rawInput, context) => {
      const input = getJobInputSchema.parse(rawInput) satisfies GetJobInput;
      const job = await client(context).getJob(input.job_id);
      return jobResponse(`Descript job is ${job.job_state ?? "unknown"}.`, job);
    }
  },
  {
    name: "descript_wait_for_job",
    title: "Wait For Descript Job",
    description: "Poll a Descript job until it stops, fails, is canceled, or times out.",
    inputSchema: waitForJobInputSchema,
    execute: async (rawInput, context) => {
      const input = waitForJobInputSchema.parse(rawInput) satisfies WaitForJobInput;
      const job = await waitForJob(client(context), input);
      return jobResponse(`Descript job is ${job.job_state ?? "unknown"}.`, job);
    }
  },
  {
    name: "descript_cancel_job",
    title: "Cancel Descript Job",
    description: "Cancel a running Descript job.",
    inputSchema: cancelJobInputSchema,
    execute: async (rawInput, context) => {
      const input = cancelJobInputSchema.parse(rawInput) satisfies CancelJobInput;
      requireConfirmation("confirm_cancel", input.confirm_cancel);
      const result = await client(context).cancelJob(input.job_id);
      return toolResponse({
        ok: true,
        summary: `Canceled Descript job ${input.job_id}.`,
        data: result,
        warnings: [],
        next_actions: ["Use descript_get_job if you need to confirm the final job state."]
      });
    }
  },
  {
    name: "descript_qc_project_changes",
    title: "QC Descript Project Changes",
    description:
      "Compare before/after project snapshots to verify new compositions and source preservation.",
    inputSchema: qcProjectChangesInputSchema,
    execute: (rawInput) => {
      const input = qcProjectChangesInputSchema.parse(rawInput) satisfies QcProjectChangesInput;
      const diffInput: ProjectDiffInput = {
        beforeProject: toProjectDetails(input.before_project, "Before project"),
        afterProject: toProjectDetails(input.after_project, "After project")
      };
      if (input.source_composition_id !== undefined) {
        diffInput.sourceCompositionId = input.source_composition_id;
      }
      if (input.expected_new_composition_count !== undefined) {
        diffInput.expectedNewCompositionCount = input.expected_new_composition_count;
      }
      if (input.max_duration_seconds !== undefined) {
        diffInput.maxDurationSeconds = input.max_duration_seconds;
      }
      return diffProjectState(diffInput);
    }
  }
];

function jobResponse(
  summary: string,
  job: JobResponse | { canceled: true; job_id: string }
): ToolResponse {
  return toolResponse({
    ok: true,
    summary,
    data: asJsonValue(job) as JsonObject,
    warnings: [],
    next_actions:
      "job_id" in job && !("canceled" in job)
        ? ["Use descript_wait_for_job or descript_get_job with this job_id to track progress."]
        : []
  });
}

function toProjectDetails(
  project: QcProjectChangesInput["before_project"],
  fallbackName: string
): ProjectDetails {
  const details: ProjectDetails = {
    id: project.id,
    name: project.name ?? fallbackName
  };
  if (project.compositions) details.compositions = project.compositions.map(toCompositionSummary);
  return details;
}

type QcCompositionInput = NonNullable<
  QcProjectChangesInput["before_project"]["compositions"]
>[number];

function toCompositionSummary(composition: QcCompositionInput): CompositionSummary {
  const summary: CompositionSummary = {
    id: composition.id,
    name: composition.name
  };
  if (composition.duration !== undefined) summary.duration = composition.duration;
  if (composition.media_type !== undefined) summary.media_type = composition.media_type;
  if (composition.type !== undefined) summary.type = composition.type;
  return summary;
}

async function waitForJob(
  clientInstance: DescriptClient,
  input: WaitForJobInput
): Promise<JobResponse> {
  const deadline = Date.now() + input.timeout_seconds * 1000;
  let lastJob: JobResponse | null = null;

  while (Date.now() < deadline) {
    lastJob = await clientInstance.getJob(input.job_id);
    const state = lastJob.job_state;
    if (state === "stopped" || state === "failed" || state === "canceled") return lastJob;
    await sleep(input.poll_interval_seconds * 1000);
  }

  return {
    ...(lastJob ?? {}),
    job_id: input.job_id,
    job_state: lastJob?.job_state ?? "timeout"
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToToolResponse(error: unknown): ToolResponse {
  if (error instanceof MissingDescriptTokenError) {
    return toolResponse({
      ok: false,
      summary: error.message,
      data: {},
      warnings: [],
      next_actions: ["Add a Descript API token to the Poke integration and retry this tool."]
    });
  }

  if (error instanceof DescriptApiError) {
    return toolResponse({
      ok: false,
      summary: error.summary,
      data: {
        status: error.status,
        body: error.body
      },
      warnings: error.warnings,
      next_actions: error.nextActions
    });
  }

  if (error instanceof ConfirmationRequiredError || error instanceof Error) {
    return toolResponse({
      ok: false,
      summary: error.message,
      data: {},
      warnings: [],
      next_actions: [
        "Add the required confirmation field when you really want Poke to run this action."
      ]
    });
  }

  return toolResponse({
    ok: false,
    summary: "Unknown connector error.",
    data: {},
    warnings: [String(error)],
    next_actions: []
  });
}

export function listToolNames(): string[] {
  return toolDefinitions.map((tool) => tool.name);
}

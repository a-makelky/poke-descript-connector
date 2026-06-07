import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Fetcher } from "../descript/types.js";
import { registerDescriptTools } from "../tools/registry.js";

const SERVER_INSTRUCTIONS = [
  "Use this connector to search, inspect, import, edit, transcribe, publish, and QC Descript projects through the user's Drive-scoped Descript API token.",
  "Start with read-only tools such as descript_search_projects, descript_get_project, descript_export_transcript, and descript_get_job when project identity or Drive access is uncertain.",
  "Descript API tokens are scoped to one Drive. If a request fails with a Drive or permission error, ask the user to confirm the target project belongs to the same Drive as the token.",
  "Mutating tools require explicit confirmation fields: confirm_import, confirm_edit, confirm_publish, or confirm_cancel. Do not set those fields unless the user clearly asked for that action.",
  "For local media files, use the hosted upload helper or request upload URLs; upload file bytes directly to Descript rather than proxying large media through this Worker.",
  "After import, edit, publish, or cancel jobs, use descript_wait_for_job or descript_get_job before claiming the operation finished. Use descript_qc_project_changes to compare before/after project snapshots when edits are expected."
].join("\n");

export type CreateDescriptMcpServerOptions = {
  apiBase: string;
  token: string;
  fetcher?: Fetcher;
};

export function createDescriptMcpServer(options: CreateDescriptMcpServerOptions): McpServer {
  const server = new McpServer(
    {
      name: "poke-descript-connector",
      version: "0.1.0"
    },
    {
      instructions: SERVER_INSTRUCTIONS
    }
  );

  registerDescriptTools(server, options);
  return server;
}

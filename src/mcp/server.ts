import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Fetcher } from "../descript/types.js";
import { registerDescriptTools } from "../tools/registry.js";

export type CreateDescriptMcpServerOptions = {
  apiBase: string;
  token: string;
  fetcher?: Fetcher;
};

export function createDescriptMcpServer(options: CreateDescriptMcpServerOptions): McpServer {
  const server = new McpServer({
    name: "poke-descript-connector",
    version: "0.1.0"
  });

  registerDescriptTools(server, options);
  return server;
}

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { JsonObject } from "../shared/json.js";

export type ToolResponse<TData extends JsonObject = JsonObject> = {
  ok: boolean;
  summary: string;
  data: TData;
  warnings: string[];
  next_actions: string[];
};

export function toolResponse<TData extends JsonObject>(
  input: ToolResponse<TData>
): ToolResponse<TData> {
  return input;
}

export function toCallToolResult(response: ToolResponse, isError = !response.ok): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2)
      }
    ],
    structuredContent: response,
    isError
  };
}

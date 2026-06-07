import { asJsonValue, type JsonObject } from "../shared/json.js";
import { toolResponse, type ToolResponse } from "../tools/response.js";
import type { CompositionSummary, ProjectDetails } from "./types.js";

export type ProjectDiffInput = {
  beforeProject: ProjectDetails;
  afterProject: ProjectDetails;
  sourceCompositionId?: string;
  expectedNewCompositionCount?: number;
  maxDurationSeconds?: number;
};

export type ProjectDiffData = JsonObject & {
  project_id: string;
  before_count: number;
  after_count: number;
  new_count: number;
  source_preserved: boolean | null;
  new_compositions: JsonObject[];
};

export function diffProjectState(input: ProjectDiffInput): ToolResponse<ProjectDiffData> {
  const beforeCompositions = input.beforeProject.compositions ?? [];
  const afterCompositions = input.afterProject.compositions ?? [];
  const beforeIds = new Set(beforeCompositions.map((composition) => composition.id));
  const newCompositions = afterCompositions.filter((composition) => !beforeIds.has(composition.id));
  const warnings: string[] = [];

  if (
    input.expectedNewCompositionCount !== undefined &&
    newCompositions.length !== input.expectedNewCompositionCount
  ) {
    warnings.push(
      `Expected ${String(input.expectedNewCompositionCount)} new compositions but found ${String(newCompositions.length)}.`
    );
  }

  if (input.maxDurationSeconds !== undefined) {
    for (const composition of newCompositions) {
      if ((composition.duration ?? 0) > input.maxDurationSeconds) {
        warnings.push(
          `${composition.name} is ${String(composition.duration)} seconds, above the ${String(input.maxDurationSeconds)} second limit.`
        );
      }
    }
  }

  const sourcePreserved =
    input.sourceCompositionId === undefined
      ? null
      : isSourceCompositionPreserved(
          beforeCompositions,
          afterCompositions,
          input.sourceCompositionId
        );

  if (sourcePreserved === false) {
    warnings.push("The source composition changed or could not be found after the operation.");
  }

  return toolResponse({
    ok: warnings.length === 0,
    summary:
      warnings.length === 0
        ? `QC passed: found ${String(newCompositions.length)} new composition${newCompositions.length === 1 ? "" : "s"}.`
        : `QC found ${String(warnings.length)} issue${warnings.length === 1 ? "" : "s"}.`,
    data: {
      project_id: input.afterProject.id,
      before_count: beforeCompositions.length,
      after_count: afterCompositions.length,
      new_count: newCompositions.length,
      source_preserved: sourcePreserved,
      new_compositions: newCompositions.map((composition) => asJsonValue(composition) as JsonObject)
    },
    warnings,
    next_actions:
      warnings.length === 0
        ? ["Review the new compositions in Descript before publishing."]
        : ["Open the project in Descript and inspect the flagged compositions."]
  });
}

function isSourceCompositionPreserved(
  beforeCompositions: CompositionSummary[],
  afterCompositions: CompositionSummary[],
  sourceCompositionId: string
): boolean {
  const before = beforeCompositions.find((composition) => composition.id === sourceCompositionId);
  const after = afterCompositions.find((composition) => composition.id === sourceCompositionId);
  return (
    before !== undefined &&
    before.name === after?.name &&
    (before.duration ?? null) === (after?.duration ?? null)
  );
}

import { z } from "zod/v4";

const uuidish = z.string().min(1);

export const searchProjectsInputSchema = z.object({
  name: z.string().optional(),
  folder_path: z.string().optional(),
  created_by: z.string().optional(),
  created_after: z.iso.datetime().optional(),
  created_before: z.iso.datetime().optional(),
  updated_after: z.iso.datetime().optional(),
  updated_before: z.iso.datetime().optional(),
  sort: z.enum(["name", "created_at", "updated_at", "last_viewed_at"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export const getProjectInputSchema = z.object({
  project_id: uuidish
});

const mediaImportItemSchema = z
  .object({
    url: z.url().optional(),
    content_type: z.string().min(1).optional(),
    file_size: z.number().int().positive().optional(),
    language: z.string().min(2).max(8).optional()
  })
  .refine(
    (item) =>
      item.url !== undefined || (item.content_type !== undefined && item.file_size !== undefined),
    {
      message: "Each media item needs either url or content_type plus file_size."
    }
  );

const clipSchema = z.looseObject({
  media: z.string(),
  start: z.number().optional(),
  end: z.number().optional()
});

const compositionSchema = z.looseObject({
  name: z.string(),
  clips: z.array(clipSchema).optional()
});

export const importMediaInputSchema = z
  .object({
    confirm_import: z.boolean().optional(),
    project_id: uuidish.optional(),
    project_name: z.string().optional(),
    team_access: z.enum(["edit", "comment", "view", "none"]).optional(),
    folder_name: z.string().optional(),
    add_media: z.record(z.string(), mediaImportItemSchema),
    add_compositions: z.array(compositionSchema).optional(),
    callback_url: z.url().optional()
  })
  .refine((body) => body.project_id !== undefined || body.project_name !== undefined, {
    message: "Provide either project_id or project_name."
  });

export const editWithUnderlordInputSchema = z
  .object({
    confirm_edit: z.boolean().optional(),
    project_id: uuidish.optional(),
    project_name: z.string().optional(),
    composition_id: uuidish.optional(),
    prompt: z.string().min(1),
    team_access: z.enum(["edit", "comment", "view", "none"]).optional(),
    callback_url: z.url().optional(),
    conversation_id: uuidish.optional()
  })
  .refine((body) => body.project_id !== undefined || body.project_name !== undefined, {
    message: "Provide either project_id or project_name."
  });

export const exportTranscriptInputSchema = z.object({
  project_id: uuidish,
  composition_id: uuidish.optional(),
  format: z.enum(["txt", "md", "html", "rtf", "docx"]).default("txt"),
  include_speaker_labels: z.enum(["off", "changes", "every_paragraph"]).default("changes"),
  include_markers: z.boolean().optional(),
  timecodes: z.record(z.string(), z.unknown()).optional()
});

export const publishMediaInputSchema = z.object({
  confirm_publish: z.boolean().optional(),
  project_id: uuidish,
  composition_id: uuidish,
  media_type: z.enum(["Video", "Audio", "GIF"]).default("Video"),
  resolution: z.enum(["480p", "720p", "1080p", "4k"]).optional(),
  access_level: z.enum(["private", "unlisted", "public"]).optional(),
  callback_url: z.url().optional()
});

export const getJobInputSchema = z.object({
  job_id: z.string().min(1)
});

export const waitForJobInputSchema = z.object({
  job_id: z.string().min(1),
  timeout_seconds: z.number().int().min(1).max(600).default(120),
  poll_interval_seconds: z.number().int().min(1).max(30).default(5)
});

export const cancelJobInputSchema = z.object({
  confirm_cancel: z.boolean().optional(),
  job_id: z.string().min(1)
});

const compositionSummarySchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  duration: z.number().optional(),
  media_type: z.string().optional(),
  type: z.string().optional()
});

const projectDetailsSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  compositions: z.array(compositionSummarySchema).optional()
});

export const qcProjectChangesInputSchema = z.object({
  before_project: projectDetailsSchema,
  after_project: projectDetailsSchema,
  source_composition_id: z.string().optional(),
  expected_new_composition_count: z.number().int().min(0).optional(),
  max_duration_seconds: z.number().positive().optional()
});

export const requestUploadUrlsInputSchema = importMediaInputSchema;

export type SearchProjectsInput = z.infer<typeof searchProjectsInputSchema>;
export type GetProjectInput = z.infer<typeof getProjectInputSchema>;
export type ImportMediaInput = z.infer<typeof importMediaInputSchema>;
export type EditWithUnderlordInput = z.infer<typeof editWithUnderlordInputSchema>;
export type ExportTranscriptInput = z.infer<typeof exportTranscriptInputSchema>;
export type PublishMediaInput = z.infer<typeof publishMediaInputSchema>;
export type GetJobInput = z.infer<typeof getJobInputSchema>;
export type WaitForJobInput = z.infer<typeof waitForJobInputSchema>;
export type CancelJobInput = z.infer<typeof cancelJobInputSchema>;
export type QcProjectChangesInput = z.infer<typeof qcProjectChangesInputSchema>;

import { describe, expect, it } from "vitest";
import { DescriptClient } from "../../src/descript/client.js";
import { diffProjectState } from "../../src/descript/qc.js";

const token = process.env.DESCRIPT_API_TOKEN;
const mediaUrl = process.env.DESCRIPT_LIVE_TEST_MEDIA_URL;
const enabled =
  process.env.LIVE_DESTRUCTIVE_DESCRIPT_TESTS === "true" && Boolean(token) && Boolean(mediaUrl);

describe.skipIf(!enabled)("live Descript regression", () => {
  it("imports demo media, edits it, exports transcript, and verifies project state", async () => {
    const client = new DescriptClient({
      apiBase: process.env.DESCRIPT_API_BASE ?? "https://descriptapi.com/v1",
      token: requiredEnv("DESCRIPT_API_TOKEN")
    });

    const demoMediaUrl = requiredEnv("DESCRIPT_LIVE_TEST_MEDIA_URL");
    const importJob = await client.importMedia({
      project_name: `Poke Connector Live Test ${new Date().toISOString()}`,
      team_access: "none",
      add_media: {
        "demo.mp4": {
          url: demoMediaUrl
        }
      },
      add_compositions: [
        {
          name: "Demo Video",
          clips: [{ media: "demo.mp4" }]
        }
      ]
    });

    const completedImport = await waitForStoppedJob(client, importJob.job_id);
    expect(completedImport.result?.status).toBe("success");
    expect(importJob.project_id).toBeTypeOf("string");
    const projectId = String(importJob.project_id);

    const beforeProject = await client.getProject(projectId);
    const editJob = await client.agentEdit({
      project_id: projectId,
      prompt:
        "Add Studio Sound and simple readable captions. Keep this as a tiny demo for connector QA."
    });

    const completedEdit = await waitForStoppedJob(client, editJob.job_id);
    expect(completedEdit.result?.status).toBe("success");

    const afterProject = await client.getProject(projectId);
    const transcript = await client.exportTranscript({
      project_id: projectId,
      format: "txt",
      include_speaker_labels: "changes"
    });

    expect(transcript.transcript.length).toBeGreaterThan(0);
    const qc = diffProjectState({ beforeProject, afterProject });
    expect(qc.data.after_count).toBeGreaterThanOrEqual(qc.data.before_count);
  }, 600_000);
});

async function waitForStoppedJob(client: DescriptClient, jobId: string) {
  for (;;) {
    const job = await client.getJob(jobId);
    if (job.job_state === "stopped") return job;
    if (job.job_state === "failed" || job.job_state === "canceled") {
      throw new Error(`Descript job ${jobId} ended as ${job.job_state}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live Descript regression tests.`);
  return value;
}

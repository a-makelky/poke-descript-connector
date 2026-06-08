const endpoint = document.querySelector("#mcp-endpoint");
const publicMcpEndpoint = "https://poke-descript.aaronmakelky.com/mcp";
if (endpoint) endpoint.textContent = publicMcpEndpoint;

const copyPromptMenu = document.querySelector("#copy-prompt-menu");
const copyPromptSummary = document.querySelector("#copy-prompt-menu > summary");
const copyStatus = document.querySelector("#copy-status");
const promptFallback = document.querySelector("#poke-prompt-fallback");

function legacyCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "-9999px";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textArea.remove();
  }

  return copied;
}

copyPromptSummary?.addEventListener("click", async () => {
  const prompt = [
    "Help me connect Poke to Descript using this MCP connector.",
    "",
    `MCP endpoint: ${publicMcpEndpoint}`,
    "Auth: API key. Use my Descript API token as the API key.",
    "",
    "Do not ask me to paste the Descript token into chat. If the token is missing, send me to the Poke integration credential field.",
    "",
    "After the integration is connected, run the first test using only the Descript integration.",
    "",
    "Call descript_search_projects with limit 1 and tell me the tool response summary.",
    "",
    "Start read-only. Do not import, edit, publish, or cancel anything unless I explicitly ask and include the required confirmation field."
  ].join("\n");

  if (promptFallback instanceof HTMLTextAreaElement) {
    promptFallback.hidden = true;
    promptFallback.value = "";
  }

  try {
    if (!legacyCopyText(prompt)) {
      if (!navigator.clipboard?.writeText) throw new Error("Copy command failed");
      await navigator.clipboard.writeText(prompt);
    }
    if (copyPromptMenu instanceof HTMLDetailsElement) copyPromptMenu.open = true;
    if (copyStatus) copyStatus.textContent = "Copied. Paste it into your Poke conversation.";
  } catch {
    if (copyStatus) copyStatus.textContent = "";
    if (copyPromptMenu instanceof HTMLDetailsElement) copyPromptMenu.open = true;
    if (promptFallback instanceof HTMLTextAreaElement) {
      promptFallback.value = prompt;
      promptFallback.hidden = false;
      promptFallback.focus();
      promptFallback.select();
    }
  }
});

const form = document.querySelector("#upload-form");
const output = document.querySelector("#upload-output");
const directUploadContentType = "application/octet-stream";
const activeJobStates = new Set([
  "created",
  "queued",
  "pending",
  "running",
  "processing",
  "in_progress",
  "started"
]);
const terminalJobStates = new Set([
  "done",
  "complete",
  "completed",
  "success",
  "succeeded",
  "stopped",
  "failed",
  "error",
  "errored",
  "canceled",
  "cancelled"
]);
const failedJobStates = new Set(["failed", "error", "errored", "canceled", "cancelled"]);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!output) return;

  const submitButton = form.querySelector("button[type='submit']");
  const originalButtonText = submitButton?.textContent ?? "Request upload URL";
  const token = document.querySelector("#token")?.value;
  const projectName = document.querySelector("#project-name")?.value || "Poke Descript Upload";
  const file = document.querySelector("#file")?.files?.[0];

  if (!token || !file) {
    setOutput({
      ok: false,
      summary: "Add a Descript token and choose a file.",
      data: {},
      warnings: [],
      next_actions: ["Choose the original local media file, not an iMessage-compressed copy."]
    });
    return;
  }

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
  }

  const mediaName = file.name;

  try {
    setOutput(
      `Requesting a signed upload URL from Descript for ${mediaName} (${formatBytes(file.size)})...`
    );

    const result = await requestUploadUrls(token, projectName, mediaName, file);
    const uploadInfo = result?.data?.upload_urls?.[mediaName];
    const uploadUrl = uploadInfo?.upload_url ?? uploadInfo?.url;

    if (!uploadUrl) {
      throw new UploadHelperError("Descript did not return an upload URL for this file.", {
        media_name: mediaName,
        descript_response: result
      });
    }

    setOutput("Got the signed upload URL. Starting browser upload to Descript...");
    const upload = await uploadWithFallback(uploadUrl, token, file);

    const jobId = result?.data?.job_id;
    if (!jobId) {
      setOutput({
        ok: true,
        summary: "Upload finished, but Descript did not return a job ID to poll.",
        data: {
          upload_status: upload.status,
          upload_method: upload.method,
          descript_job: result.data
        },
        warnings: ["No job_id was present in the Descript import response."],
        next_actions: ["Open the new Descript project and confirm the media resolution there."]
      });
      return;
    }

    setOutput(
      `Upload accepted by Descript with status ${upload.status}. Waiting for job ${jobId}...`
    );
    const finalJob = await pollJob(token, jobId, (job, attempt) => {
      const state = getJobState(job) || "unknown";
      const progress = getJobProgress(job);
      const progressText = progress ? ` (${progress})` : "";
      setOutput(`Descript job ${jobId}: ${state}${progressText}. Poll ${attempt}.`);
    });

    const finalState = getJobState(finalJob);
    const jobFailed = isFailedJob(finalJob);
    setOutput({
      ok: !jobFailed,
      summary: jobFailed
        ? `Upload finished, but Descript job ${jobId} ended as ${finalState}.`
        : "Upload finished and Descript finished processing the file.",
      data: {
        upload_status: upload.status,
        upload_method: upload.method,
        upload_response: upload.body,
        descript_job: result.data,
        final_job: finalJob
      },
      warnings: jobFailed ? ["Descript reported a failed or canceled job state."] : [],
      next_actions: [
        "Open the Descript project and confirm the imported media resolution.",
        "For iPhone source checks, compare this browser-uploaded project against the iMessage-uploaded project."
      ]
    });
  } catch (error) {
    setOutput(formatUploadError(error));
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

async function requestUploadUrls(token, projectName, mediaName, file) {
  const response = await fetch("/api/descript/upload-urls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      confirm_import: true,
      project_name: projectName,
      team_access: "none",
      add_media: {
        [mediaName]: {
          content_type: file.type || "application/octet-stream",
          file_size: file.size
        }
      },
      add_compositions: [{ name: "Main", clips: [{ media: mediaName }] }]
    })
  });

  const result = await readJsonResponse(response);
  if (!response.ok) {
    throw new UploadHelperError(result?.summary || "Descript rejected the upload URL request.", {
      status: response.status,
      response: result
    });
  }
  return result;
}

function uploadFileWithProgress(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.timeout = 15 * 60 * 1000;
    xhr.responseType = "text";
    xhr.setRequestHeader("Content-Type", directUploadContentType);

    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      const percent = total ? Math.round((event.loaded / total) * 100) : null;
      onProgress({ loaded: event.loaded, total, percent });
    };

    xhr.onload = () => {
      const body = xhr.responseText || "";
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status, body, method: "direct_signed_url" });
        return;
      }

      reject(
        new UploadHelperError(`Descript upload URL returned HTTP ${xhr.status}.`, {
          status: xhr.status,
          response: body.slice(0, 2000)
        })
      );
    };

    xhr.onerror = () => {
      reject(
        new UploadHelperError(
          "Upload failed before Descript accepted the file. The signed upload URL may have rejected the browser request.",
          { status: xhr.status || null }
        )
      );
    };

    xhr.ontimeout = () => {
      reject(
        new UploadHelperError("Upload timed out before Descript accepted the full file.", {
          timeout_ms: xhr.timeout
        })
      );
    };

    xhr.onabort = () => {
      reject(new UploadHelperError("Upload was aborted.", {}));
    };

    xhr.send(file);
  });
}

async function uploadWithFallback(uploadUrl, token, file) {
  try {
    return await uploadFileWithProgress(uploadUrl, file, ({ loaded, total, percent }) => {
      const totalText = total ? ` of ${formatBytes(total)}` : "";
      const percentText = percent === null ? "" : ` ${percent}%`;
      setOutput(
        `Uploading directly to Descript:${percentText} (${formatBytes(loaded)}${totalText})`
      );
    });
  } catch (directError) {
    setOutput({
      ok: false,
      summary: "Direct upload was blocked by the browser. Trying the Worker relay.",
      data: { direct_upload_error: summarizeError(directError) },
      warnings: [],
      next_actions: []
    });

    return uploadFileThroughWorker(uploadUrl, token, file, ({ loaded, total, percent }) => {
      const totalText = total ? ` of ${formatBytes(total)}` : "";
      const percentText = percent === null ? "" : ` ${percent}%`;
      const waitingText = percent === 100 ? " Waiting for Descript to accept it..." : "";
      setOutput(
        `Uploading through Worker relay:${percentText} (${formatBytes(loaded)}${totalText}).${waitingText}`
      );
    });
  }
}

function uploadFileThroughWorker(uploadUrl, token, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/descript/upload-proxy");
    xhr.timeout = 15 * 60 * 1000;
    xhr.responseType = "text";
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", directUploadContentType);
    xhr.setRequestHeader("X-Descript-Upload-Url", uploadUrl);

    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      const percent = total ? Math.round((event.loaded / total) * 100) : null;
      onProgress({ loaded: event.loaded, total, percent });
    };

    xhr.onload = () => {
      let result;
      try {
        result = parseUploadProxyResponse(xhr.responseText, xhr.status);
      } catch (error) {
        reject(error);
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: result?.data?.upload_status ?? xhr.status,
          body: result,
          method: "worker_relay"
        });
        return;
      }

      reject(
        new UploadHelperError(result?.summary || `Worker relay returned HTTP ${xhr.status}.`, {
          status: xhr.status,
          response: result
        })
      );
    };

    xhr.onerror = () => {
      reject(
        new UploadHelperError("Worker relay upload failed before the file reached the Worker.", {
          status: xhr.status || null
        })
      );
    };

    xhr.ontimeout = () => {
      reject(
        new UploadHelperError("Worker relay upload timed out before Descript accepted the file.", {
          timeout_ms: xhr.timeout
        })
      );
    };

    xhr.onabort = () => {
      reject(new UploadHelperError("Worker relay upload was aborted.", {}));
    };

    xhr.send(file);
  });
}

function parseUploadProxyResponse(text, status) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new UploadHelperError("Worker relay returned a non-JSON response.", {
      status,
      response: text.slice(0, 2000)
    });
  }
}

async function pollJob(token, jobId, onStatus) {
  const maxAttempts = 150;
  let lastJob = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await delay(attempt === 1 ? 1200 : 4000);
    const job = await fetchJob(token, jobId);
    lastJob = job;
    onStatus(job, attempt);

    if (isTerminalJob(job)) return job;
  }

  throw new UploadHelperError(`Timed out waiting for Descript job ${jobId}.`, {
    last_job: lastJob,
    max_attempts: maxAttempts
  });
}

async function fetchJob(token, jobId) {
  const response = await fetch(`/api/descript/jobs/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await readJsonResponse(response);
  if (!response.ok) {
    throw new UploadHelperError(result?.summary || `Could not fetch Descript job ${jobId}.`, {
      status: response.status,
      response: result
    });
  }
  return result?.data ?? result;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new UploadHelperError("The server returned a non-JSON response.", {
      status: response.status,
      response: text.slice(0, 2000)
    });
  }
}

function isTerminalJob(job) {
  const state = getJobState(job);
  if (!state) return false;
  if (terminalJobStates.has(state)) return true;
  return !activeJobStates.has(state);
}

function isFailedJob(job) {
  const state = getJobState(job);
  const resultStatus = String(job?.result?.status ?? "")
    .trim()
    .toLowerCase();
  return failedJobStates.has(state) || failedJobStates.has(resultStatus);
}

function getJobState(job) {
  return String(job?.job_state ?? job?.state ?? job?.status ?? "")
    .trim()
    .toLowerCase();
}

function getJobProgress(job) {
  const progress = job?.progress;
  if (!progress) return "";
  if (typeof progress === "string") return progress;
  return progress.label ?? progress.message ?? progress.status ?? "";
}

function formatUploadError(error) {
  if (error instanceof UploadHelperError) {
    return {
      ok: false,
      summary: error.message,
      data: error.details,
      warnings: [],
      next_actions: [
        "Refresh the page and retry with the original local file.",
        "If upload progress never starts, the signed upload URL is rejecting the browser upload before bytes reach Descript."
      ]
    };
  }

  return {
    ok: false,
    summary: error instanceof Error ? error.message : "Unknown upload helper error.",
    data: {},
    warnings: [],
    next_actions: ["Refresh the page and try the upload again."]
  };
}

function summarizeError(error) {
  if (error instanceof UploadHelperError) {
    return { summary: error.message, data: error.details };
  }

  return { summary: error instanceof Error ? error.message : "Unknown upload error." };
}

function setOutput(value) {
  if (!output) return;
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

class UploadHelperError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "UploadHelperError";
    this.details = details;
  }
}

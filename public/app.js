const endpoint = document.querySelector("#mcp-endpoint");
const publicMcpEndpoint = "https://poke-descript.aaronmakelky.com/mcp";
if (endpoint) endpoint.textContent = publicMcpEndpoint;

const copyPromptMenu = document.querySelector("#copy-prompt-menu");
const copyPromptButton = document.querySelector("#copy-poke-prompt");
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

copyPromptButton?.addEventListener("click", async () => {
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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
    } else if (!legacyCopyText(prompt)) {
      throw new Error("Copy command failed");
    }
    if (copyStatus) copyStatus.textContent = "Copied. Paste it into your Poke conversation.";
  } catch {
    const copied = legacyCopyText(prompt);

    if (copied) {
      if (copyStatus) copyStatus.textContent = "Copied. Paste it into your Poke conversation.";
      return;
    }

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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!output) return;

  const token = document.querySelector("#token")?.value;
  const projectName = document.querySelector("#project-name")?.value || "Poke Descript Upload";
  const file = document.querySelector("#file")?.files?.[0];

  if (!token || !file) {
    output.textContent = "Add a Descript token and choose a file.";
    return;
  }

  output.textContent = "Requesting a signed upload URL from Descript...";

  const mediaName = file.name;
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

  const result = await response.json();
  const uploadUrl = result?.data?.upload_urls?.[mediaName]?.upload_url;

  if (!response.ok || !uploadUrl) {
    output.textContent = JSON.stringify(result, null, 2);
    return;
  }

  output.textContent = "Uploading directly to Descript...";

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(file.size)
    },
    body: file
  });

  output.textContent = JSON.stringify(
    {
      upload_status: upload.status,
      descript_job: result.data,
      next_step: "Use descript_wait_for_job with the returned job_id."
    },
    null,
    2
  );
});

const endpoint = document.querySelector("#mcp-endpoint");
if (endpoint) endpoint.textContent = `${window.location.origin}/mcp`;

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

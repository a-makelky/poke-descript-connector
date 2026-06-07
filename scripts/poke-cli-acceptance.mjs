import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const endpoint =
  process.env.CONNECTOR_MCP_URL ?? "https://poke-descript-connector.aaron-345.workers.dev/mcp";
const integrationName = process.env.POKE_INTEGRATION_NAME ?? "Descript";
const token = process.env.DESCRIPT_API_TOKEN;

const preflight = await run("npx", ["-y", "poke@latest", "whoami"], { allowFailure: true });
if (preflight.exitCode !== 0) {
  exitWithJson(2, {
    ok: false,
    stage: "poke_auth",
    summary: "Poke CLI is not logged in.",
    next_actions: ["Log in with npx poke@latest login, then rerun this acceptance script."]
  });
}

if (process.env.RUN_POKE_ACCEPTANCE !== "true") {
  exitWithJson(2, {
    ok: false,
    stage: "confirmation",
    summary: "Refusing to send a Descript token to Poke without RUN_POKE_ACCEPTANCE=true.",
    next_actions: [
      "Use a test Descript Drive token.",
      "Set RUN_POKE_ACCEPTANCE=true only when you intend to create or update the Poke integration."
    ]
  });
}

if (!token) {
  exitWithJson(2, {
    ok: false,
    stage: "descript_token",
    summary: "DESCRIPT_API_TOKEN is required for the Poke integration acceptance test.",
    next_actions: ["Create a Descript API token for a test Drive and set DESCRIPT_API_TOKEN."]
  });
}

const add = await run("npx", [
  "-y",
  "poke@latest",
  "mcp",
  "add",
  endpoint,
  "-n",
  integrationName,
  "-k",
  token
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint,
      integrationName,
      pokeUser: sanitize(preflight.stdout),
      output: sanitize(add.stdout),
      next_actions: [
        "Open Poke Kitchen.",
        "Create or update the Descript Connector recipe.",
        "Select this Descript integration as required.",
        "Confirm Kitchen discovers the 10 Descript MCP tools."
      ]
    },
    null,
    2
  )
);

async function run(command, args, options = {}) {
  try {
    const result = await exec(command, args, {
      env: process.env,
      maxBuffer: 1024 * 1024
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const exitCode = typeof error.code === "number" ? error.code : 1;
    const result = {
      exitCode,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : String(error)
    };
    if (options.allowFailure) return result;
    exitWithJson(exitCode, {
      ok: false,
      stage: "poke_cli",
      summary: "Poke CLI command failed.",
      stdout: sanitize(result.stdout),
      stderr: sanitize(result.stderr)
    });
  }
}

function sanitize(value) {
  return token ? value.replaceAll(token, "[REDACTED_DESCRIPT_API_TOKEN]") : value;
}

function exitWithJson(exitCode, payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

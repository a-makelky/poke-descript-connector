# Poke Recipe Setup

Poke's current docs define a recipe as a Kitchen object that bundles onboarding context, required integrations, and a share/install link. This connector is the required MCP integration for that recipe.

## Integration

Create a custom MCP integration in Poke:

- Name: `Descript`
- MCP Server URL: `https://poke-descript-connector.aaron-345.workers.dev/mcp`
- API key: the user's Descript API token

If you attach a custom domain later, use `https://<your-domain>/mcp` instead.

Poke sends that API key to the Worker as:

```text
Authorization: Bearer <DESCRIPT_API_TOKEN>
```

Poke also sends `X-Poke-User-Id`. The connector does not store that identifier or the Descript token.

## Recipe

Create a Poke recipe that requires the Descript MCP integration.

Suggested recipe basics:

- Name: `Descript Connector`
- Description: `Run Descript search, import, edit, transcript export, publish, and QC workflows from Poke.`

Suggested `inputContext`:

```text
Connect your Descript API token. Tokens are scoped to one Descript Drive, so use the token from the Drive that owns the projects you want Poke to edit. Start by searching or exporting before making changes.
```

Suggested `prefilledFirstText`:

```text
Search my Descript projects for a recent recording and show me the available compositions before editing anything.
```

Required integration:

- `Descript`

Credential sharing:

- Leave disabled for public use. Each user should paste their own Descript token.

## User Guidance

Start read-only:

- "Search my Descript projects for API office hours."
- "Get the project details for this project ID."
- "Export the transcript from this composition."

Then mutate with explicit confirmation:

- "Import this media URL into a new Descript project. Set confirm_import to true."
- "Ask Underlord to add captions and Studio Sound. Set confirm_edit to true."
- "Publish this composition at 1080p. Set confirm_publish to true."

This is like asking a player to repeat the play call before the snap. It prevents accidental edits.

## Acceptance Checklist

Code-level hosted smoke:

```bash
npm run test:hosted
```

Optional read-only Descript smoke through the hosted MCP endpoint:

```bash
LIVE_READONLY_DESCRIPT_TESTS=true DESCRIPT_API_TOKEN=... npm run test:hosted
```

Poke Kitchen smoke:

1. Log in to Poke.
2. Create the MCP integration above.
3. Confirm Poke discovers 10 tools.
4. Create and publish the recipe with the settings above.
5. Install the recipe from the generated share link.
6. Run this first prompt:

```text
Search my Descript projects and return one project with its project_id. Do not edit anything.
```

Full live acceptance:

1. Use a test Descript Drive and demo media only.
2. Ask Poke to import demo media with `confirm_import: true`.
3. Wait for the job with `descript_wait_for_job`.
4. Ask Poke to export the transcript.
5. Ask Poke to run `descript_qc_project_changes`.

Do not paste a real production Descript token into a shared recipe. Public users should bring their own token during install.

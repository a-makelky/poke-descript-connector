# Live QC

Live QC proves the real Poke-to-MCP-to-Descript chain, not just local mocks.

## Required Environment

```bash
DESCRIPT_API_TOKEN=<token for a test Descript Drive>
DESCRIPT_LIVE_TEST_MEDIA_URL=<public or presigned URL for demo media>
LIVE_DESTRUCTIVE_DESCRIPT_TESTS=true
```

## What The Live Test Should Cover

- token/Drive access
- demo media import
- Underlord edit
- job polling
- transcript export
- optional publish/export
- before/after project state comparison

## 2026-06-07 QC Snapshot

Current hosted Worker:

- Install page: `https://poke-descript-connector.aaron-345.workers.dev/`
- MCP endpoint: `https://poke-descript-connector.aaron-345.workers.dev/mcp`
- Latest deployed version checked in this pass: `c99c397a-e804-485d-8a41-31ffec055d95`

Passed:

- Hosted install page returned HTTP 200.
- Hosted MCP smoke found all 10 expected tools.
- Poke Kitchen `Descript` integration template returned `Connected! Found 10 tools.`
- Direct MCP initialize returned `poke-descript-connector`.
- Direct MCP unauthenticated request returned HTTP 401.
- Direct MCP mutation gate rejected `descript_import_media` without `confirm_import: true`.
- Live read-only Descript search found 1 project.
- Live read-only project fetch succeeded.
- Live read-only transcript export succeeded without recording transcript content.
- Mutating MCP tools rejected missing confirmation fields for import, Underlord edit, publish, and cancel.
- Upload helper rejected missing `confirm_import: true`.
- Public install page explains per-user tokens, no Worker token storage, and Descript token rotation.

Prepared but not run in this snapshot:

- Demo media URL: `https://samplelib.com/mp3/sample-3s.mp3`
- Destructive workflow: import demo media, wait for job, export transcript, optional Underlord edit, QC before/after.

Only run the destructive workflow with a disposable Descript Drive or explicit approval to create a test project in the token's current Drive.

## Drive Mismatch

If Descript returns `403 Project does not belong to the specified drive`, treat it as a Drive mismatch first. The token may be valid, but scoped to a different Drive than the target project.

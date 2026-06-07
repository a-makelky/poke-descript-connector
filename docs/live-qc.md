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
- Latest deployed version checked in this pass: `182ccdbf-139e-4be8-8a75-c777b67e3a01`

Passed:

- Hosted install page returned HTTP 200.
- Hosted MCP smoke found all 10 expected tools.
- Poke Kitchen `Descript` integration template returned `Connected! Found 10 tools.`
- Poke app `Retry Connection` on the `descript` integration succeeded after deploying version `182ccdbf-139e-4be8-8a75-c777b67e3a01`.
- Poke app integration detail showed Descript MCP tools: Search Projects, Get Project, Import Media, Edit With Underlord, Export Transcript, and 5 more.
- Direct MCP initialize returned `poke-descript-connector`.
- Direct MCP initialize and `tools/list` now work without a Descript token, so Poke can discover tools before user credentials are attached.
- Direct MCP unauthenticated `tools/call` returns a structured missing-token tool error instead of blocking discovery.
- Direct MCP mutation gate rejected `descript_import_media` without `confirm_import: true`.
- Live read-only Descript search found 1 project.
- Live read-only project fetch succeeded.
- Live read-only transcript export succeeded without recording transcript content.
- Mutating MCP tools rejected missing confirmation fields for import, Underlord edit, publish, and cancel.
- Upload helper rejected missing `confirm_import: true`.
- Public install page explains per-user tokens, no Worker token storage, and Descript token rotation.
- Destructive signed-upload workflow succeeded with demo media.
- Demo media import job stopped with `success`.
- Underlord edit job stopped with `success`.
- Transcript export after the destructive workflow succeeded without recording transcript content.
- QC after the destructive workflow passed with 0 warnings.
- Poke over iMessage returned `PB Tip 10 - How I Make Videos With AI and Descript`, but this should not be treated as Descript MCP proof because Poke may have found the same title through another connected source.
- Poke over iMessage succeeded after a forced Descript-only prompt: Poke was told not to use Notion, Gmail, Drive, or memory, and returned `found 1 descript project` plus a project title and UUID-shaped project ID. The private project title and ID are intentionally not recorded here.

Destructive workflow evidence:

- Project name: `Poke Connector Full Smoke 2026-06-07T18:15:17.680Z`
- Demo media source: `https://samplelib.com/mp3/sample-3s.mp3`
- Demo media size: 52,079 bytes
- Upload path: signed upload URL requested through the connector, bytes uploaded directly to Descript
- Transcript content type: `text/plain; charset=utf-8`

Do not record Descript tokens, signed upload URLs, project IDs, job IDs, or transcript contents in this public repo.

Observed Poke app issue:

- After clicking `Retry Connection` on Poke's integration detail page, Poke's app route rendered blank.
- The browser console showed React error #31 for an object with keys `{message, status}`.
- The Poke integrations list still loaded and showed `descript`.
- This was resolved by allowing unauthenticated MCP discovery before Descript API token enforcement.
- Do not record account-specific Poke integration route IDs in this public repo.

## Drive Mismatch

If Descript returns `403 Project does not belong to the specified drive`, treat it as a Drive mismatch first. The token may be valid, but scoped to a different Drive than the target project.

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

## Drive Mismatch

If Descript returns `403 Project does not belong to the specified drive`, treat it as a Drive mismatch first. The token may be valid, but scoped to a different Drive than the target project.

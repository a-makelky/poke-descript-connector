# Poke Descript Connector

Open-source Poke recipe connector for Descript. It exposes the Descript API as a Streamable HTTP MCP server that can be installed in Poke, then used from natural language.

The intended user path is simple:

1. Open the hosted connector page.
2. Create a Descript API token for the right Drive.
3. Add the connector as a Poke MCP integration.
4. Ask Poke to search, create, edit, export, or publish Descript projects.

Current hosted connector:

- Install page: `https://poke-descript-connector.aaron-345.workers.dev/`
- MCP endpoint: `https://poke-descript-connector.aaron-345.workers.dev/mcp`

## What It Does

This connector gives Poke these Descript tools:

- `descript_search_projects`
- `descript_get_project`
- `descript_import_media`
- `descript_edit_with_underlord`
- `descript_export_transcript`
- `descript_publish_media`
- `descript_get_job`
- `descript_wait_for_job`
- `descript_cancel_job`
- `descript_qc_project_changes`

Mutating tools require explicit confirmation fields, so Poke has to be clear before it spends credits, edits projects, publishes media, or cancels jobs.

## Architecture

- Cloudflare Worker at `/mcp`
- Workers Static Assets for the public install page
- Per-user Descript token passed as `Authorization: Bearer <DESCRIPT_API_TOKEN>`
- No server-side token storage
- Descript API base URL defaults to `https://descriptapi.com/v1`

The connector is the offensive coordinator: Poke calls a named MCP tool, and the Worker translates that into the right Descript API play without exposing anyone else's Drive.

## Development

Requirements:

- Node.js 24+
- npm
- Cloudflare account for deployment

Useful scripts:

```bash
npm run dev
npm test
npm run test:worker
npm run build
npm run lint
npm run check
npm run deploy
```

Generate Worker types after changing `wrangler.jsonc`:

```bash
npm run types:worker
```

## Live Descript QC

Default tests do not call Descript. Live tests are opt-in because they create real Descript jobs:

```bash
DESCRIPT_API_TOKEN=... DESCRIPT_LIVE_TEST_MEDIA_URL=https://... LIVE_DESTRUCTIVE_DESCRIPT_TESTS=true npm run test:live
```

Use a token for a test Drive and demo media that is safe to import, not a production customer Drive.

## Deployment

See [docs/deployment.md](docs/deployment.md).

## Poke Recipe Setup

See [docs/poke-recipe.md](docs/poke-recipe.md).

## Security

Do not commit tokens, downloaded media, private project IDs, or `.env*` files. See [SECURITY.md](SECURITY.md).

## License

MIT

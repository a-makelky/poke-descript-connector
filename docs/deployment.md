# Deployment

This project is designed for Cloudflare Workers.

## Worker Shape

- Static install page: `/`
- MCP endpoint: `/mcp`
- Health check: `/health`
- Browser upload helper: `/api/descript/upload-urls`

`wrangler.jsonc` routes `/mcp`, `/mcp/*`, and `/api/*` to the Worker before static assets.

## Staging

Use the `staging` environment for first deploys and Poke tunnel parity checks.

```bash
npm run types:worker
npm run check
npm run deploy -- --env staging
```

## Production

Deploy production after staging passes Poke discovery and one real Descript smoke test.

```bash
npm run deploy -- --env production
```

## Custom Domain

Point a Cloudflare route or custom domain at the production Worker. For a public test project,
prefer a dedicated subdomain such as:

```text
poke-descript.aaronmakelky.com
```

The public MCP URL will be:

```text
https://<your-domain>/mcp
```

Use that URL in Poke Kitchen when creating the integration template or recipe. This is mostly a
trust and polish improvement over `workers.dev`; the real security boundary is still that each Poke
user supplies their own Descript API token and the Worker does not store it.

When Descript is ready to own the integration, the same Worker shape can move behind an official
Descript domain, such as an `api.descript.com` MCP path.

## Observability

Worker observability is enabled in `wrangler.jsonc`. Logs should not include Descript tokens or raw media contents.

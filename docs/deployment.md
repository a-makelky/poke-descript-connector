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

Point a Cloudflare route or custom domain at the production Worker. The public MCP URL will be:

```text
https://<your-domain>/mcp
```

Use that URL in Poke Kitchen when creating the integration template or recipe.

## Observability

Worker observability is enabled in `wrangler.jsonc`. Logs should not include Descript tokens or raw media contents.

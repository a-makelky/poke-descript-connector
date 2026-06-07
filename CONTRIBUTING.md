# Contributing

## Local Setup

Install dependencies and run the local checks:

```bash
npm install
npm run types:worker
npm run check
```

## Development Standards

- Keep tools small and named after user intent.
- Add tests before changing connector behavior.
- Keep Descript API details behind `src/descript/client.ts`.
- Do not add shared-token mode.
- Do not commit private media, downloaded outputs, or secrets.
- Prefer plain-language errors. A user should know what to do next.

## Pull Requests

Every PR should include:

- what changed
- tests run
- any Descript API behavior that was verified live
- whether any new tool can mutate Descript state

## Live Tests

Live tests are optional and require:

```bash
DESCRIPT_API_TOKEN=...
LIVE_DESTRUCTIVE_DESCRIPT_TESTS=true
```

Use a test Drive.

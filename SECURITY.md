# Security Policy

## Supported Versions

Security fixes target the latest `main` branch until this project starts publishing tagged releases.

## Sensitive Data Rules

Never commit:

- Descript API tokens
- Poke API keys
- `.env*` files
- downloaded user media
- private project IDs or customer data
- live job outputs from private Descript Drives

The hosted connector should receive a user's Descript API token through the Poke MCP integration `Authorization` header and forward it to Descript. It should not store tokens.

## Reporting a Vulnerability

Open a private security advisory on GitHub if available. If not, open an issue with a minimal description and no secrets, then coordinate details privately with the maintainer.

## Design Notes

- Descript API tokens are Drive-scoped.
- A valid token can fail with `403` when the target project belongs to another Drive.
- Mutating tools require explicit confirmation fields.
- Local file uploads should use Descript signed upload URLs, with browser-to-Descript upload. The Worker should not proxy large local media files.

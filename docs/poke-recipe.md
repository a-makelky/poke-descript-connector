# Poke Recipe Setup

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

## Recipe

Create a Poke recipe that requires the Descript MCP integration.

Suggested onboarding context:

```text
Connect your Descript API token. Tokens are scoped to one Descript Drive, so use the token from the Drive that owns the projects you want Poke to edit.
```

Suggested first message:

```text
Search my Descript projects for a recent recording and show me the available compositions before editing anything.
```

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

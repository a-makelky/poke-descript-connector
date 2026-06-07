export class MissingDescriptTokenError extends Error {
  constructor(
    message = "Descript API token is missing. Add it as a Bearer token on the Poke integration."
  ) {
    super(message);
    this.name = "MissingDescriptTokenError";
  }
}

export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader?.trim()) {
    throw new MissingDescriptTokenError();
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]?.trim()) {
    throw new MissingDescriptTokenError(
      "Expected Authorization: Bearer <DESCRIPT_API_TOKEN>. Poke should pass the user's Descript token to this MCP server."
    );
  }

  return match[1].trim();
}

export class ConfirmationRequiredError extends Error {
  constructor(fieldName: string) {
    super(`This mutating Descript action requires ${fieldName}: true.`);
    this.name = "ConfirmationRequiredError";
  }
}

export function requireConfirmation(fieldName: string, value: unknown): void {
  if (value !== true) throw new ConfirmationRequiredError(fieldName);
}

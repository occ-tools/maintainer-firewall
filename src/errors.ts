export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error) {
    return Number((error as { status?: unknown }).status);
  }

  return undefined;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

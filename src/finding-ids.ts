export const PROTECTED_FINDING_IDS = ["content.secret.possible"] as const;

const PROTECTED_FINDING_ID_SET = new Set<string>(PROTECTED_FINDING_IDS);

export function isProtectedFindingId(id: string): boolean {
  return PROTECTED_FINDING_ID_SET.has(id);
}

export function parsePositiveInt(value: string | undefined, flag: string, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${flag} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

/** "pr-3, pr-5" → ["pr-3", "pr-5"]; absent or blank → null (meaning "all"). */
export function parseIdList(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
  return ids.length > 0 ? ids : null;
}

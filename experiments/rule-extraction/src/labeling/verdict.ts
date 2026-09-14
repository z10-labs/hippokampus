import { VERDICTS, type Verdict } from "./types";

const VERDICT_BY_SHORTCUT: Readonly<Record<string, Verdict>> = { c: "correct", p: "partial", w: "wrong" };

/** Accepts "c", "partial", or a verdict followed by a note: "w logging detail, not a rule". */
export function parseVerdict(input: string): { verdict: Verdict; note: string } | null {
  const [head = "", ...rest] = input.trim().split(/\s+/);
  const key = head.toLowerCase();
  const verdict = VERDICT_BY_SHORTCUT[key] ?? VERDICTS.find((candidate) => candidate === key);
  return verdict ? { verdict, note: rest.join(" ") } : null;
}

export function parseYesNo(input: string): boolean | null {
  const answer = input.trim().toLowerCase();
  if (answer === "y" || answer === "yes") return true;
  if (answer === "n" || answer === "no") return false;
  return null;
}

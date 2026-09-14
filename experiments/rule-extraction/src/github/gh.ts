import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { z } from "zod";

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 512 * 1024 * 1024;

/** Runs the GitHub CLI without a shell, so arguments are never interpreted. */
export async function gh(args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("gh", [...args], { maxBuffer: MAX_BUFFER_BYTES });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`\`gh ${args.join(" ")}\` failed: ${stderr || String(error)}`);
  }
}

function parseWith<T>(raw: string, schema: z.ZodType<T>, args: readonly string[]): T {
  const result = schema.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error(`Unexpected output from \`gh ${args.join(" ")}\`: ${result.error.message}`);
  }
  return result.data;
}

export async function ghJson<T>(args: readonly string[], schema: z.ZodType<T>): Promise<T> {
  return parseWith(await gh(args), schema, args);
}

/** For `--jq '.[] | {...}'` output: one JSON object per line. */
export async function ghJsonLines<T>(args: readonly string[], schema: z.ZodType<T>): Promise<T[]> {
  const stdout = await gh(args);
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => parseWith(line, schema, args));
}

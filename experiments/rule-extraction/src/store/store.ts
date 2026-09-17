import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { DATA_ROOT } from "../config";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export function assertRepo(repo: string): string {
  if (!REPO_PATTERN.test(repo)) {
    throw new Error(`Expected --repo as owner/name, got "${repo}"`);
  }
  return repo;
}

/** `variant` is "<model>/<prompt version>", so each prompt iteration keeps its own results. */
export function repoPaths(repo: string, variant: string) {
  const root = path.join(DATA_ROOT, assertRepo(repo).replace("/", "__"));
  return {
    root,
    changeSets: path.join(root, "changesets"),
    contextMap: path.join(root, "context-map.json"),
    extractions: path.join(root, "extractions", variant),
    labels: path.join(root, "labels", variant),
    reports: path.join(root, "reports"),
  };
}

export const jsonFile = (dir: string, id: string): string => path.join(dir, `${id}.json`);

export async function writeText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  const result = schema.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error(`Invalid data in ${filePath}: ${result.error.message}`);
  }
  return result.data;
}

export async function readAllJson<T>(dir: string, schema: z.ZodType<T>): Promise<T[]> {
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map((name) => readJson(path.join(dir, name), schema)));
}

export const MODEL = "claude-sonnet-5";

/**
 * Bump whenever SYSTEM_PROMPT or the extraction schema changes. Extractions and labels
 * are stored per model and prompt version so iterations can be scored side by side.
 */
export const PROMPT_VERSION = "v3";
export const EXTRACTION_VARIANT = `${MODEL}/${PROMPT_VERSION}`;

/** Claude Sonnet 5 list prices, USD per million tokens (cache write 1.25×, cache read 0.1× input). */
export const PRICE_PER_MTOK = {
  input: 2,
  output: 10,
  cacheWrite: 2.5,
  cacheRead: 0.2,
} as const;

/** Non-streaming ceiling that stays inside SDK request timeouts. */
export const MAX_OUTPUT_TOKENS = 16_000;
export const EXTRACTION_EFFORT = "high";

/** Used only for the rough pre-extraction cost estimate printed by `fetch` (includes thinking). */
export const ASSUMED_OUTPUT_TOKENS_PER_EXTRACTION = 6_000;
export const APPROX_CHARS_PER_TOKEN = 3.5;

export const DEFAULT_PR_LIMIT = 200;
export const DEFAULT_COMMIT_LIMIT = 300;
export const DEFAULT_CONCURRENCY = 3;

export const DATA_ROOT = "data";

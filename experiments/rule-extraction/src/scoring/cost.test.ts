import { describe, expect, test } from "vitest";
import { ASSUMED_OUTPUT_TOKENS_PER_EXTRACTION } from "../config";
import { EMPTY_USAGE, estimateUsd, roughExtractionUsd, sumUsage } from "./cost";

describe("estimateUsd", () => {
  test("prices each token class at Sonnet 5 rates", () => {
    expect(estimateUsd({ ...EMPTY_USAGE, inputTokens: 1_000_000 })).toBeCloseTo(2);
    expect(estimateUsd({ ...EMPTY_USAGE, outputTokens: 1_000_000 })).toBeCloseTo(10);
    expect(estimateUsd({ ...EMPTY_USAGE, cacheCreationInputTokens: 1_000_000 })).toBeCloseTo(2.5);
    expect(estimateUsd({ ...EMPTY_USAGE, cacheReadInputTokens: 1_000_000 })).toBeCloseTo(0.2);
  });
});

describe("sumUsage", () => {
  test("adds usage field by field", () => {
    const one = { inputTokens: 1, outputTokens: 2, cacheCreationInputTokens: 3, cacheReadInputTokens: 4 };

    expect(sumUsage([one, one])).toEqual({ inputTokens: 2, outputTokens: 4, cacheCreationInputTokens: 6, cacheReadInputTokens: 8 });
    expect(sumUsage([])).toEqual(EMPTY_USAGE);
  });
});

describe("roughExtractionUsd", () => {
  test("adds an assumed output allowance per extraction", () => {
    const expected = (500_000 * 2 + 2 * ASSUMED_OUTPUT_TOKENS_PER_EXTRACTION * 10) / 1_000_000;

    expect(roughExtractionUsd([200_000, 300_000])).toBeCloseTo(expected);
  });
});

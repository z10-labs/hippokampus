import { describe, expect, test } from "vitest";
import { parseIdList, parsePositiveInt } from "./args";

describe("parsePositiveInt", () => {
  test("falls back when the flag is absent", () => {
    expect(parsePositiveInt(undefined, "concurrency", 3)).toBe(3);
  });

  test("parses a positive integer", () => {
    expect(parsePositiveInt("12", "pr-limit", 200)).toBe(12);
  });

  test.each(["0", "-1", "2.5", "abc"])("rejects %j", (value) => {
    expect(() => parsePositiveInt(value, "concurrency", 3)).toThrow("--concurrency must be a positive integer");
  });
});

describe("parseIdList", () => {
  test("splits and trims comma-separated ids", () => {
    expect(parseIdList(" pr-3, pr-5 ,")).toEqual(["pr-3", "pr-5"]);
  });

  test.each([undefined, "", " , "])("returns null for %j", (value) => {
    expect(parseIdList(value)).toBeNull();
  });
});

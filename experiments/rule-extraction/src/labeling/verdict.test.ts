import { describe, expect, test } from "vitest";
import { parseVerdict, parseYesNo } from "./verdict";

describe("parseVerdict", () => {
  test.each([
    ["c", { verdict: "correct", note: "" }],
    ["P", { verdict: "partial", note: "" }],
    ["wrong", { verdict: "wrong", note: "" }],
    ["  w   logging detail, not a rule ", { verdict: "wrong", note: "logging detail, not a rule" }],
    ["partial merges two rules", { verdict: "partial", note: "merges two rules" }],
  ])("parses %j", (input, expected) => {
    expect(parseVerdict(input)).toEqual(expected);
  });

  test.each(["", "x", "correctish", "yes"])("rejects %j", (input) => {
    expect(parseVerdict(input)).toBeNull();
  });
});

describe("parseYesNo", () => {
  test.each([
    ["y", true],
    ["YES", true],
    ["n", false],
    [" no ", false],
    ["", null],
    ["maybe", null],
  ])("parses %j as %s", (input, expected) => {
    expect(parseYesNo(input)).toBe(expected);
  });
});

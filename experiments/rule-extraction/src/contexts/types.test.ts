import { describe, expect, test } from "vitest";
import { makeBoundedContext, makeContextMap } from "../testing/fixtures";
import { ContextMapSchema } from "./types";

describe("ContextMapSchema", () => {
  test("accepts a well-formed map", () => {
    const map = makeContextMap();

    expect(ContextMapSchema.parse(map)).toEqual(map);
  });

  test("rejects duplicate context ids", () => {
    const map = makeContextMap({ contexts: [makeBoundedContext("invoicing"), makeBoundedContext("invoicing")] });

    const result = ContextMapSchema.safeParse(map);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('duplicate context id \\"invoicing\\"');
  });

  test.each([
    ["an id that isn't kebab-case", { id: "Invoicing Area" }, "kebab-case"],
    ["a context without path patterns", { pathPatterns: [] }, "at least one path pattern"],
  ])("rejects %s", (_label, overrides, message) => {
    const map = makeContextMap({ contexts: [{ ...makeBoundedContext("invoicing"), ...overrides }] });

    expect(ContextMapSchema.safeParse(map).error?.message).toContain(message);
  });
});

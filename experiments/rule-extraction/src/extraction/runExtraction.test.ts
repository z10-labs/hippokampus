import { describe, expect, test } from "vitest";
import { assertContextMapProvenance } from "./runExtraction";

describe("assertContextMapProvenance", () => {
  test("accepts an extraction made with the current map", () => {
    expect(() =>
      assertContextMapProvenance([{ changeSetId: "pr-1", contextMapHash: "same-hash" }], "same-hash", false, null),
    ).not.toThrow();
  });

  test.each([null, "old-hash"])("requires a forced re-extraction for map hash %s", (existingHash) => {
    expect(() =>
      assertContextMapProvenance([{ changeSetId: "pr-1", contextMapHash: existingHash }], "current-hash", false, null),
    ).toThrow(
      /different context map.*--force/,
    );
  });

  test("rejects a partial forced run that would leave mixed map provenance", () => {
    expect(() =>
      assertContextMapProvenance(
        [{ changeSetId: "pr-1", contextMapHash: "old-hash" }],
        "current-hash",
        true,
        ["pr-2"],
      ),
    ).toThrow(/omit --only.*--force/);
  });

  test("allows a full forced run to replace every stale record", () => {
    expect(() =>
      assertContextMapProvenance(
        [{ changeSetId: "pr-1", contextMapHash: "old-hash" }],
        "current-hash",
        true,
        null,
      ),
    ).not.toThrow();
  });
});

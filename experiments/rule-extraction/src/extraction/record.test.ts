import { describe, expect, test } from "vitest";
import { makeRecord, makeRule } from "../testing/fixtures";
import { ExtractionRecordSchema } from "./record";

describe("ExtractionRecordSchema", () => {
  test("round-trips a current record unchanged", () => {
    const record = makeRecord();

    expect(ExtractionRecordSchema.parse(record)).toEqual(record);
  });

  test("still loads v1 records written before owners and exclusions existed", () => {
    const { business_owner: _owner, ...v1Rule } = makeRule();
    const { promptVersion: _version, ...current } = makeRecord();
    const { excluded_technical_changes: _excluded, ...v1Extraction } = current.extraction;
    const v1Record = { ...current, extraction: { ...v1Extraction, rules: [v1Rule] } };

    const parsed = ExtractionRecordSchema.parse(v1Record);

    expect(parsed.promptVersion).toBe("v1");
    expect(parsed.extraction.excluded_technical_changes).toEqual([]);
    expect(parsed.extraction.rules[0]?.business_owner).toBe("unspecified");
  });
});

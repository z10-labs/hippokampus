import { describe, expect, test } from "vitest";
import { makeRule } from "../testing/fixtures";
import { ExtractionSchema, extractionSchemaForContextIds } from "./schema";

const validExtraction = () => ({
  changes_business_rules: true,
  classification_reason: "Changes terms.",
  excluded_technical_changes: ["Startup credential checks"],
  rules: [makeRule()],
});

describe("ExtractionSchema", () => {
  test("accepts a well-formed extraction", () => {
    const extraction = validExtraction();

    expect(ExtractionSchema.parse(extraction)).toEqual(extraction);
  });

  test("rejects rule types outside the ontology", () => {
    const extraction = { ...validExtraction(), rules: [{ ...makeRule(), rule_type: "vibes" }] };

    expect(ExtractionSchema.safeParse(extraction).success).toBe(false);
  });

  test("requires every rule to name a business owner", () => {
    const { business_owner: _omitted, ...ruleWithoutOwner } = makeRule();

    expect(ExtractionSchema.safeParse({ ...validExtraction(), rules: [ruleWithoutOwner] }).success).toBe(false);
  });
});

describe("extractionSchemaForContextIds", () => {
  test("accepts only confirmed context ids or null", () => {
    const schema = extractionSchemaForContextIds(["invoicing", "payments"]);

    expect(schema.safeParse({ ...validExtraction(), rules: [makeRule({ bounded_context: "invoicing" })] }).success).toBe(true);
    expect(schema.safeParse({ ...validExtraction(), rules: [makeRule({ bounded_context: null })] }).success).toBe(true);
    expect(schema.safeParse({ ...validExtraction(), rules: [makeRule({ bounded_context: "invented" })] }).success).toBe(false);
  });

  test("requires null when no confirmed contexts exist", () => {
    const schema = extractionSchemaForContextIds([]);

    expect(schema.safeParse({ ...validExtraction(), rules: [makeRule({ bounded_context: null })] }).success).toBe(true);
    expect(schema.safeParse({ ...validExtraction(), rules: [makeRule({ bounded_context: "invoicing" })] }).success).toBe(false);
  });
});

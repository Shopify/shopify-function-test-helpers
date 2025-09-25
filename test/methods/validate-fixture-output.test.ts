import { describe, it, expect, beforeAll } from "vitest";
import { validateFixtureOutput } from "../../src/methods/validate-fixture-output.ts";
import {
  loadFixture,
  loadSchema,
  FixtureData,
} from "../../src/wasm-testing-helpers.ts";
import { GraphQLSchema } from "graphql";

describe("validateFixtureOutput", () => {
  let schema: GraphQLSchema;
  let fixture: FixtureData;

  beforeAll(async () => {
    schema = await loadSchema("./test/fixtures/test-schema.graphql");
    fixture = await loadFixture("./test/fixtures/valid-test-fixture.json");
  });

  describe("Mutation-Based Validation", () => {
    it("should validate a valid fixture", async () => {
      const result = await validateFixtureOutput(
        fixture.expectedOutput,
        schema,
        "processData",
        "result"
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate output fixture with validation errors", async () => {
      const outputWithErrors = {
        ...fixture.expectedOutput,
        operations: [
          {
            addValidation: {
              errors: [
                {
                  message: "Test validation error",
                  target: "$.cart.lines[0].quantity",
                },
              ],
            },
          },
        ],
      };

      const result = await validateFixtureOutput(
        outputWithErrors,
        schema,
        "processData",
        "result"
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle invalid mutation name", async () => {
      const outputData = fixture.expectedOutput;

      const result = await validateFixtureOutput(
        outputData,
        schema,
        "nonExistentMutation",
        "result"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        "Mutation 'nonExistentMutation' not found"
      );
    });

    it("should handle invalid parameter name", async () => {
      const outputData = fixture.expectedOutput;

      const result = await validateFixtureOutput(
        outputData,
        schema,
        "processData",
        "nonExistentParam"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        "Parameter 'nonExistentParam' not found"
      );
    });

    it("should validate against other mutations in the schema", async () => {
      // Test with fetchData mutation which has different input type
      const fetchOutputData = {
        request: {
          url: "https://example.com/api",
          method: "POST",
          headers: "Content-Type: application/json",
          body: "test body",
        },
      };

      const result = await validateFixtureOutput(
        fetchOutputData,
        schema,
        "fetchData",
        "input"
      );

      expect(result.mutationName).toBe("fetchData");
      expect(result.resultParameterType).toBe("FetchDataResult!");
      expect(result.errors).toHaveLength(0);
    });

    it("should detect type mismatches in fixture data", async () => {
      // Start with fixture output and modify it to have wrong data types
      const invalidOutputData = {
        ...fixture.expectedOutput,
        operations: "this should be an array", // Wrong type
      };

      const result = await validateFixtureOutput(
        invalidOutputData,
        schema,
        "processData",
        "result"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        'Expected type "DataOperation" to be an object. At "operations"'
      );
    });

    it("should detect extra fields in ValidationAddOperation", async () => {
      // Start with loaded fixture output and add extra fields that shouldn't be allowed
      const outputWithExtraFields = {
        ...fixture.expectedOutput,
        operations: [
          {
            addValidation: {
              errors: [
                {
                  message: "Test validation error",
                  target: "$.cart.lines[0].quantity",
                },
              ],
              // These fields don't exist in the ValidationAddOperation schema
              extraField1: "this should not be allowed",
              extraField2: 123,
              nestedExtra: {
                invalidNested: "also invalid",
              },
            },
          },
        ],
      };

      const result = await validateFixtureOutput(
        outputWithExtraFields,
        schema,
        "processData",
        "result"
      );

      // Should detect each extra field as a separate error
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);

      // Check each extra field gets its own specific error
      expect(result.errors[0].message).toBe(
        'Field "extraField1" is not defined by type "AddValidationOperation". At "operations.0.addValidation"'
      );
      expect(result.errors[1].message).toBe(
        'Field "extraField2" is not defined by type "AddValidationOperation". At "operations.0.addValidation"'
      );
      expect(result.errors[2].message).toBe(
        'Field "nestedExtra" is not defined by type "AddValidationOperation". At "operations.0.addValidation"'
      );
    });
  });
});

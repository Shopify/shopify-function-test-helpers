import { describe, it, expect } from "vitest";

import {
  validateTestAssets,
  loadFixture,
  loadInputQuery,
  loadSchema,
} from "../../src/wasm-testing-helpers.ts";

describe("validateTestAssets", () => {
  // Helper function to load test data
  async function loadTestData() {
    const schema = await loadSchema("./test/fixtures/test-schema.graphql");
    const fixture = await loadFixture("./test/fixtures/valid-fixture.json");
    const inputQueryAST = await loadInputQuery(
      "./test/fixtures/valid-query.graphql",
    );
    return { schema, fixture, inputQueryAST };
  }

  describe("Valid Test Case", () => {
    it("should automatically determine mutation details from target", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Don't provide mutationName or resultParameterName - let it auto-determine
      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
      });

      // Should automatically determine the correct mutation details
      expect(result.mutationName).toBe("processData");
      expect(result.resultParameterName).toBe("result");

      expect(result.inputQuery.errors).toHaveLength(0);
      expect(result.inputFixture.errors).toHaveLength(0);
      expect(result.outputFixture.errors).toHaveLength(0);
    });

    it("should perform complete validation workflow with valid test fixture", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
      });

      // Validate result structure
      expect(result).toHaveProperty("mutationName");
      expect(result).toHaveProperty("resultParameterName");
      expect(result).toHaveProperty("inputQuery");
      expect(result).toHaveProperty("inputFixture");
      expect(result).toHaveProperty("outputFixture");

      expect(result.inputQuery.errors).toHaveLength(0);
      expect(result.inputFixture.errors).toHaveLength(0);
      expect(result.outputFixture.errors).toHaveLength(0);
    });
  });

  describe("Invalid Output Test Case", () => {
    it("should detect invalid output fixture with extra fields", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Modify the fixture to have invalid output data (extra fields)
      const invalidFixture = {
        ...fixture,
        expectedOutput: {
          ...fixture.expectedOutput,
          extraField: "should not exist",
        },
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST,
      });

      expect(result.inputQuery.errors).toHaveLength(0);

      expect(result.inputFixture.errors).toHaveLength(0);

      expect(result.outputFixture.errors.length).toBe(1);
      expect(result.outputFixture.errors[0].message).toContain(
        'Field "extraField" is not defined by type "ProcessDataResult"',
      );
    });
  });

  describe("Invalid Input Cases", () => {
    it("should detect invalid input fixture with wrong data types", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Modify fixture to have wrong data types in input
      const invalidFixture = {
        ...fixture,
        input: {
          data: {
            items: [
              {
                id: "gid://test/Item/1",
                count: "not_a_number", // count should be number
              },
            ],
          },
        },
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST,
      });

      expect(result.inputQuery.errors).toHaveLength(0);

      // Input fixture should be invalid due to type mismatch and missing fields
      expect(result.inputFixture.errors.length).toBe(3);
      expect(result.inputFixture.errors[0]).toContain(
        'Int cannot represent non-integer value: "not_a_number"',
      );
      expect(result.inputFixture.errors[1]).toBe(
        "Missing expected fixture data for details",
      );
      expect(result.inputFixture.errors[2]).toBe(
        "Missing expected fixture data for metadata",
      );
    });

    it("should detect input fixture with invalid fields", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Modify fixture to have invalid field that doesn't exist in schema
      const invalidFixture = {
        ...fixture,
        input: {
          data: {
            items: [
              {
                id: "gid://test/Item/1",
                count: 2,
                invalidField: "this field doesn't exist in schema",
              },
            ],
          },
        },
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST,
      });

      expect(result.inputQuery.errors).toHaveLength(0);

      // Input fixture should be invalid due to missing fields and extra field
      expect(result.inputFixture.errors.length).toBe(3);
      expect(result.inputFixture.errors[0]).toBe('Missing expected fixture data for details');
      expect(result.inputFixture.errors[1]).toBe('Extra field "invalidField" found in fixture data not in query');
      expect(result.inputFixture.errors[2]).toBe('Missing expected fixture data for metadata');

      expect(result.outputFixture.errors).toHaveLength(0);
    });
  });

  describe("Invalid Query Cases", () => {
    it("should detect invalid fields in input query", async () => {
      const { schema, fixture } = await loadTestData();

      const invalidQueryAST = await loadInputQuery(
        "./test/fixtures/wrong-fields-query.graphql",
      );

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST: invalidQueryAST,
      });

      // Input query should be invalid due to non-existent fields
      expect(result.inputQuery.errors.length).toBe(3);
      expect(result.inputQuery.errors[0].message).toContain(
        "Cannot query field",
      );
    });

    it("should handle query with valid syntax but schema mismatch", async () => {
      const { schema, fixture } = await loadTestData();

      // Valid GraphQL syntax but fields that don't exist in our schema
      const mismatchQueryAST = await loadInputQuery(
        "./test/fixtures/wrong-fields-query.graphql",
      );

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST: mismatchQueryAST,
      });

      // Input query should be invalid due to schema mismatch
      expect(result.inputQuery.errors.length).toBe(3);
      expect(result.inputQuery.errors[0].message).toContain(
        'Cannot query field "nonExistentField" on type "Item"',
      );
      expect(result.inputQuery.errors[1].message).toContain(
        'Cannot query field "anotherInvalidField" on type "ItemDetails"',
      );
      expect(result.inputQuery.errors[2].message).toContain(
        'Cannot query field "invalidMetadataField" on type "Metadata"',
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid mutation name", async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
        mutationName: "nonExistentMutation",
        resultParameterName: "result",
      });

      expect(result.outputFixture.errors.length).toBe(1);
      expect(result.outputFixture.errors[0].message).toContain(
        "Mutation 'nonExistentMutation' not found",
      );
    });
  });
});

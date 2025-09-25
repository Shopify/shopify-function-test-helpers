import { validateFixture, loadFixture, loadInputQuery, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateFixture', () => {
  // Helper function to load test data
  async function loadTestData() {
    const schema = await loadSchema('./test/fixtures/test-schema.graphql');
    const fixture = await loadFixture('./test/fixtures/valid-test-fixture.json');
    const inputQueryAST = await loadInputQuery('./test/fixtures/test-query.graphql');
    return { schema, fixture, inputQueryAST };
  }

  describe('Valid Test Case', () => {
    it('should perform complete validation workflow with valid test fixture', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Validate result structure
      expect(result).toHaveProperty('mutationName');
      expect(result).toHaveProperty('resultParameterName');
      expect(result).toHaveProperty('inputQuery');
      expect(result).toHaveProperty('inputFixture');
      expect(result).toHaveProperty('inputQueryFixtureMatch');
      expect(result).toHaveProperty('outputFixture');

      // Input query validation should pass
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);

      // Input fixture validation should pass
      expect(result.inputFixture.valid).toBe(true);
      expect(result.inputFixture.errors).toHaveLength(0);

      // Input query-fixture match validation should pass
      expect(result.inputQueryFixtureMatch.valid).toBe(true);
      expect(result.inputQueryFixtureMatch.errors).toHaveLength(0);

      // Output fixture validation should pass
      expect(result.outputFixture.valid).toBe(true);
      expect(result.outputFixture.errors).toHaveLength(0);

      // Overall validation should pass
      expect(result.inputQuery.valid && result.inputFixture.valid && result.inputQueryFixtureMatch.valid && result.outputFixture.valid).toBe(true);
    });

    it('should automatically determine mutation details from target', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Don't provide mutationName or resultParameterName - let it auto-determine
      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST
      });

      // Should automatically determine the correct mutation details
      expect(result.mutationName).toBe('processData');
      expect(result.resultParameterName).toBe('result');

      // Validation should still pass with auto-determined values
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputFixture.valid).toBe(true);
      expect(result.outputFixture.valid).toBe(true);
    });
  });

  describe('Invalid Output Test Case', () => {
    it('should detect invalid output fixture with extra fields', async () => {
      const { schema, inputQueryAST } = await loadTestData();
      
      // Create fixture with invalid output data (extra fields)
      const invalidFixture = {
        input: { cart: { lines: [{ quantity: 1, merchandise: { id: "123" } }] } },
        expectedOutput: {
          operations: [{
            addValidation: {
              errors: [{ message: "Test error", target: "$.cart" }],
              extraField: "should not exist"
            }
          }]
        },
        target: "data.processing.generate.run"
      };

      const result = await validateFixture({
        schema,
        fixture: invalidFixture,
        inputQueryAST,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be valid, but fixture might be invalid due to structure mismatch
      expect(result.inputQuery.valid).toBe(true);

      // Output fixture should be invalid due to extra field
      expect(result.outputFixture.valid).toBe(false);
      expect(result.outputFixture.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Input Cases', () => {
    it('should detect invalid input fixture with wrong data types', async () => {
      const { schema, inputQueryAST } = await loadTestData();
      
      // Create fixture with wrong data types in input
      const invalidFixture = {
        input: { cart: { lines: [{ quantity: "invalid_number" }] } }, // quantity should be number
        expectedOutput: { operations: [] },
        target: "data.processing.generate.run"
      };

      const result = await validateFixture({
        schema,
        fixture: invalidFixture,
        inputQueryAST,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be valid
      expect(result.inputQuery.valid).toBe(true);

      // Input fixture should be invalid due to query/schema mismatch
      expect(result.inputFixture.valid).toBe(false);
      expect(result.inputFixture.errors.length).toBe(1);
      expect(result.inputFixture.errors[0]).toContain('Cannot query field');
    });

    it('should handle input fixture with missing fields gracefully', async () => {
      const { schema, inputQueryAST } = await loadTestData();
      
      // Create fixture with missing fields
      const incompleteFixture = {
        input: { cart: {} }, // Missing lines
        expectedOutput: { operations: [] },
        target: "data.processing.generate.run"
      };

      const result = await validateFixture({
        schema,
        fixture: incompleteFixture,
        inputQueryAST,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be valid
      expect(result.inputQuery.valid).toBe(true);

      // Input fixture should be invalid due to query/schema mismatch  
      expect(result.inputFixture.valid).toBe(false);

      // Output fixture should be valid
      expect(result.outputFixture.valid).toBe(true);
    });
  });

  describe('Invalid Query Cases', () => {
    it('should detect GraphQL syntax errors in input query', async () => {
      const { schema, fixture } = await loadTestData();
      
      // Invalid GraphQL syntax (missing closing brace)
      const invalidQuery = "query { invalidField";

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST: invalidQuery,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBeGreaterThan(0);
      expect(result.inputQuery.errors[0].message).toContain('Syntax Error');

      // Input fixture should be valid
      expect(result.inputFixture.valid).toBe(true);

      // Output fixture should be valid
      expect(result.outputFixture.valid).toBe(true);
    });

    it('should detect invalid fields in input query', async () => {
      const { schema, fixture } = await loadTestData();
      
      // Valid syntax but invalid fields
      const invalidQuery = "query { invalidField anotherInvalidField }";

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST: invalidQuery,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to non-existent fields
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBeGreaterThan(0);
      expect(result.inputQuery.errors[0].message).toContain('Cannot query field');

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle completely empty input query', async () => {
      const { schema, fixture } = await loadTestData();

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST: "",
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(1);
      expect(result.inputQuery.errors[0].message).toContain('Syntax Error');

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle query with valid syntax but schema mismatch', async () => {
      const { schema, fixture } = await loadTestData();
      
      // Valid GraphQL syntax but fields that don't exist in our schema
      const mismatchQuery = "query { someOtherField { nested } }";

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST: mismatchQuery,
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to schema mismatch
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBeGreaterThan(0);

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid mutation name', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateFixture({
        schema,
        fixture,
        inputQueryAST,
        mutationName: 'nonExistentMutation',
        resultParameterName: 'result'
      });

      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
      expect(result.outputFixture.valid).toBe(false);
      expect(result.outputFixture.errors.length).toBe(1);
    });
  });
});
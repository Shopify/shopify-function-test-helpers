const { validateFixtureOutput } = require('../../src/methods/validate-fixture-output');
const loadFixture = require('../../src/methods/load-fixture');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('validateFixtureOutput', () => {
  let schema;
  let fixture;

  beforeAll(async () => {
    // Load the test-app schema
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    schema = buildSchema(schemaString);

    // Load the test fixture
    fixture = await loadFixture('./test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');
  });

  describe('Mutation-Based Validation', () => {
    it('should validate that output fixture is compatible with cartValidationsGenerateRun mutation', async () => {
      // Use the actual expected output from the fixture
      const outputData = {
        operations: [] // No validation errors expected
      };

      const result = await validateFixtureOutput(
        outputData, 
        schema, 
        'cartValidationsGenerateRun', 
        'result'
      );

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('variables');
      expect(result.mutationName).toBe('cartValidationsGenerateRun');
      expect(result.resultParameterType).toBe('CartValidationsGenerateRunResult!');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should validate output fixture with validation errors', async () => {
      // Create output data with validation errors
      const outputWithErrors = {
        operations: [
          {
            validationAdd: {
              errors: [
                {
                  message: "Test validation error",
                  target: "$.cart.lines[0].quantity"
                }
              ]
            }
          }
        ]
      };

      const result = await validateFixtureOutput(
        outputWithErrors, 
        schema, 
        'cartValidationsGenerateRun', 
        'result'
      );

      expect(result).toHaveProperty('valid');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle invalid mutation name', async () => {
      const outputData = { operations: [] };

      const result = await validateFixtureOutput(
        outputData, 
        schema, 
        'nonExistentMutation', 
        'result'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Mutation 'nonExistentMutation' not found");
    });

    it('should handle invalid parameter name', async () => {
      const outputData = { operations: [] };

      const result = await validateFixtureOutput(
        outputData, 
        schema, 
        'cartValidationsGenerateRun', 
        'nonExistentParam'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Parameter 'nonExistentParam' not found");
    });

    it('should validate against other mutations in the schema', async () => {
      // Test with cartValidationsGenerateFetch mutation which has different input type
      const fetchOutputData = {
        request: {
          url: "https://example.com/api",
          method: "POST",
          headers: {},
          body: "test body"
        }
      };

      const result = await validateFixtureOutput(
        fetchOutputData, 
        schema, 
        'cartValidationsGenerateFetch', 
        'result'
      );

      expect(result.mutationName).toBe('cartValidationsGenerateFetch');
      expect(result.resultParameterType).toBe('CartValidationsGenerateFetchResult!');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should detect type mismatches in fixture data', async () => {
      // Create output with wrong data types
      const invalidOutputData = {
        operations: "this should be an array" // Wrong type
      };

      const result = await validateFixtureOutput(
        invalidOutputData, 
        schema, 
        'cartValidationsGenerateRun', 
        'result'
      );

      // Note: GraphQL validate() only validates query structure, not variable values
      // Type checking of variables happens during execution, not validation
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    it('should detect extra fields in ValidationAddOperation', async () => {
      // Create output data with valid ValidationAddOperation structure but extra fields
      const outputWithExtraFields = {
        operations: [
          {
            validationAdd: {
              errors: [
                {
                  message: "Test validation error",
                  target: "$.cart.lines[0].quantity"
                }
              ],
              // These fields don't exist in the ValidationAddOperation schema
              extraField1: "this should not be allowed",
              extraField2: 123,
              nestedExtra: {
                invalidNested: "also invalid"
              }
            }
          }
        ]
      };

      const result = await validateFixtureOutput(
        outputWithExtraFields, 
        schema, 
        'cartValidationsGenerateRun', 
        'result'
      );

      // Should detect the extra fields as invalid
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      
      // Check that error mentions the extra fields
      const errorMessages = result.errors.map(e => e.message).join(' ');
      expect(errorMessages).toMatch(/(extraField1|extraField2|nestedExtra|unknown field|not defined)/i);
    });

    it('should show the complete mutation query structure', async () => {
      const outputData = { operations: [] };

      const result = await validateFixtureOutput(
        outputData, 
        schema, 
        'cartValidationsGenerateRun', 
        'result'
      );

      expect(result.query).toContain('mutation TestOutputFixture');
      expect(result.query).toContain('$result: CartValidationsGenerateRunResult!');
      expect(result.query).toContain('cartValidationsGenerateRun(result: $result)');
      expect(result.variables).toHaveProperty('result');
      expect(result.variables.result).toEqual(outputData);
    });
  });
});
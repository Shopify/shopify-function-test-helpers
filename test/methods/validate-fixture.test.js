const { validateFixture } = require('../../src/methods/validate-fixture');
const path = require('path');

describe('validateFixture', () => {
  describe('Valid Test Case', () => {
    it('should perform complete validation workflow with valid test fixture', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Validate result structure
      expect(result).toHaveProperty('schemaPath');
      expect(result).toHaveProperty('fixturePath');
      expect(result).toHaveProperty('inputQueryPath');
      expect(result).toHaveProperty('mutationName');
      expect(result).toHaveProperty('inputQuery');
      expect(result).toHaveProperty('inputFixture');
      expect(result).toHaveProperty('outputFixture');

      // Input query validation should pass
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);

      // Input fixture validation should pass
      expect(result.inputFixture.valid).toBe(true);
      expect(result.inputFixture.errors).toHaveLength(0);

      // Output fixture validation should pass
      expect(result.outputFixture.valid).toBe(true);
      expect(result.outputFixture.errors).toHaveLength(0);

      // Overall validation should pass
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBe(true);
    });

    it('should automatically determine mutation details from target', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql'
        // No mutationName or resultParameterName provided - should be auto-determined
      });

      // Should automatically determine the correct mutation details
      expect(result.mutationName).toBe('processData');
      expect(result.resultParameterName).toBe('result');

      // Validation should still pass with auto-determined values
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);
      expect(result.inputFixture.valid).toBe(true);
      expect(result.inputFixture.errors).toHaveLength(0);
      expect(result.outputFixture.valid).toBe(true);
      expect(result.outputFixture.errors).toHaveLength(0);

      // Overall validation should pass
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBe(true);
    });
  });

  describe('Invalid Output Test Case', () => {
    it('should detect invalid output fixture with extra fields', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/invalid-output-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query and fixture should be valid
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputFixture.valid).toBe(true);

      // Output fixture should be invalid due to extra field
      expect(result.outputFixture.valid).toBe(false);
      expect(result.outputFixture.errors.length).toBe(1);

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });
  });

  describe('Invalid Input Cases', () => {
    it('should detect invalid input fixture with wrong data types', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/invalid-input-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be valid
      expect(result.inputQuery.valid).toBe(true);

      // Input fixture should be invalid due to wrong data type
      expect(result.inputFixture.valid).toBe(false);
      expect(result.inputFixture.errors.length).toBe(1);
      expect(result.inputFixture.errors[0]).toContain('Int cannot represent');

      // Output fixture might still be valid
      expect(result.outputFixture.valid).toBe(true);

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle input fixture with missing fields gracefully', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/missing-required-fields-fixture.json',
        inputQueryPath: './test/fixtures/query-for-missing-field.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be valid
      expect(result.inputQuery.valid).toBe(true);

      // Input fixture validation may pass (GraphQL allows missing fields, they become null)
      // This demonstrates that GraphQL validation is about query structure, not data completeness
      expect(result.inputFixture.valid).toBe(true);

      // Output fixture should be valid
      expect(result.outputFixture.valid).toBe(true);

      // Overall validation may pass - this shows GraphQL's permissive approach to missing data
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBe(true);
    });
  });

  describe('Invalid Query Cases', () => {
    it('should detect GraphQL syntax errors in input query', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/syntax-error-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to syntax error
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(1);
      expect(result.inputQuery.errors[0].message).toContain('Syntax Error');

      // Input fixture should be valid
      expect(result.inputFixture.valid).toBe(true);

      // Output fixture should be valid
      expect(result.outputFixture.valid).toBe(true);

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should detect invalid fields in input query', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/wrong-fields-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to non-existent fields
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(3);
      expect(result.inputQuery.errors[0].message).toContain('Cannot query field');

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle completely empty input query', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/empty-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to empty content
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(1);
      expect(result.inputQuery.errors[0].message).toContain('Syntax Error');

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle query with valid syntax but schema mismatch', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/wrong-fields-query.graphql', // Uses nonExistentField
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      // Input query should be invalid due to schema mismatch
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(3);

      // Overall validation should fail
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent schema file', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/non-existent-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'processData'
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('ENOENT');
    });

    it('should handle non-existent fixture file', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/non-existent-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'processData'
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown error loading fixture file');
    });

    it('should handle invalid query file', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/wrong-fields-query.graphql',
        mutationName: 'processData',
        resultParameterName: 'result'
      });

      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(3);
      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
    });

    it('should handle invalid mutation name', async () => {
      const result = await validateFixture({
        schemaPath: './test/fixtures/test-schema.graphql',
        fixturePath: './test/fixtures/valid-test-fixture.json',
        inputQueryPath: './test/fixtures/test-query.graphql',
        mutationName: 'nonExistentMutation',
        resultParameterName: 'result'
      });

      expect(result.inputQuery.valid && result.inputFixture.valid && result.outputFixture.valid).toBeFalsy();
      expect(result.outputFixture.valid).toBe(false);
      expect(result.outputFixture.errors.length).toBe(1);
    });
  });
});
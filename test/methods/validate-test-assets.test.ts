import { describe, it, expect } from 'vitest';
import { validateTestAssets, loadFixture, loadInputQuery, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateTestAssets', () => {
  // Helper function to load test data
  async function loadTestData() {
    const schema = await loadSchema('./test/fixtures/schemas/schema.graphql');
    const fixture = await loadFixture('./test/fixtures/data/valid/basic.json');
    const inputQueryAST = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');
    return { schema, fixture, inputQueryAST };
  }

  describe('Valid Test Case', () => {

    it('should automatically determine mutation details from target', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      // Don't provide mutationName or resultParameterName - let it auto-determine
      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });

      // Should automatically determine the correct mutation details
      expect(result.mutationName).toBe('processData');
      expect(result.resultParameterName).toBe('result');

      expect(result.inputQuery.valid).toBe(true);
      expect(result.fixtureInputTypes.valid).toBe(true);
      expect(result.fixtureInputStructure.valid).toBe(true);
      expect(result.fixtureOutput.valid).toBe(true);
    });
    
    it('should perform complete validation workflow with valid test fixture', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });

      // Validate result structure
      expect(result).toHaveProperty('mutationName');
      expect(result).toHaveProperty('resultParameterName');
      expect(result).toHaveProperty('inputQuery');
      expect(result).toHaveProperty('fixtureInputTypes');
      expect(result).toHaveProperty('fixtureInputStructure');
      expect(result).toHaveProperty('fixtureOutput');

      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);

      expect(result.fixtureInputTypes.valid).toBe(true);
      expect(result.fixtureInputTypes.errors).toHaveLength(0);

      expect(result.fixtureInputStructure.valid).toBe(true);
      expect(result.fixtureInputStructure.errors).toHaveLength(0);

      expect(result.fixtureOutput.valid).toBe(true);
      expect(result.fixtureOutput.errors).toHaveLength(0);

      expect(result.inputQuery.valid && result.fixtureInputTypes.valid && result.fixtureInputStructure.valid && result.fixtureOutput.valid).toBe(true);
    });
  });

  describe('Invalid Output Test Case', () => {
    it('should detect invalid output fixture with extra fields', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();
      
      // Modify the fixture to have invalid output data (extra fields)
      const invalidFixture = {
        ...fixture,
        expectedOutput: {
          ...fixture.expectedOutput,
          extraField: "should not exist"
        }
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST
      });

      expect(result.inputQuery.valid).toBe(true);

      expect(result.fixtureInputTypes.valid).toBe(true);

      expect(result.fixtureInputStructure.valid).toBe(true);

      expect(result.fixtureOutput.valid).toBe(false);
      expect(result.fixtureOutput.errors.length).toBe(1);
      expect(result.fixtureOutput.errors[0].message).toContain('Field "extraField" is not defined by type "ProcessDataResult"');
    });
  });

  describe('Invalid Input Cases', () => {
    it('should detect invalid input fixture with wrong data types', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();
      
      // Modify fixture to have wrong data types in input
      const invalidFixture = {
        ...fixture,
        input: {
          data: {
            items: [{
              id: "gid://test/Item/1",
              count: "not_a_number", // count should be number
              details: {
                id: "gid://test/ItemDetails/123",
                name: "Test Item"
              }
            }],
            metadata: {
              email: "test@example.com"
            }
          }
        }
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST
      });

      expect(result.inputQuery.valid).toBe(true);

      // Input fixture should be invalid due to query/schema mismatch
      expect(result.fixtureInputTypes.valid).toBe(false);
      expect(result.fixtureInputTypes.errors.length).toBeGreaterThan(0);
      // Should contain type error from GraphQL execution
      const hasTypeError = result.fixtureInputTypes.errors.some(e =>
        e.includes('Int cannot represent non-integer value') || e.includes('not_a_number')
      );
      expect(hasTypeError).toBe(true);
    });

    it('should detect input fixture with invalid fields', async () => {
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
                invalidField: "this field doesn't exist in schema"
              }
            ]
          }
        }
      };

      const result = await validateTestAssets({
        schema,
        fixture: invalidFixture,
        inputQueryAST
      });

      expect(result.inputQuery.valid).toBe(true);

      // Input fixture structure should be invalid due to fixture having fields not in query
      expect(result.fixtureInputStructure.valid).toBe(false);
      expect(result.fixtureInputStructure.errors.length).toBeGreaterThan(0);
      // Should contain error about invalidField not being in query
      const hasInvalidFieldError = result.fixtureInputStructure.errors.some(e =>
        e.includes('invalidField')
      );
      expect(hasInvalidFieldError).toBe(true);

      expect(result.fixtureOutput.valid).toBe(true);
    });
  });

  describe('Invalid Query Cases', () => {
    it('should detect invalid fields in input query', async () => {
      const { schema, fixture } = await loadTestData();
      
      const invalidQueryAST = await loadInputQuery('./test/fixtures/queries/invalid/wrong-fields.graphql');

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST: invalidQueryAST
      });

      // Input query should be invalid due to non-existent fields
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(2);
      expect(result.inputQuery.errors[0].message).toContain('Cannot query field');

      expect(result.inputQuery.valid && result.fixtureInputTypes.valid && result.fixtureInputStructure.valid && result.fixtureOutput.valid).toBeFalsy();
    });

    it('should validate complete test with all fragment corner cases', async () => {
      const schema = await loadSchema('./test/fixtures/schemas/schema.graphql');
      const fixture = await loadFixture('./test/fixtures/data/valid/complete-test.json');
      const inputQueryAST = await loadInputQuery('./test/fixtures/queries/valid/complete-test.graphql');

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });

      // All validations should pass
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);

      expect(result.fixtureInputTypes.valid).toBe(true);
      expect(result.fixtureInputTypes.errors).toHaveLength(0);

      expect(result.fixtureInputStructure.valid).toBe(true);
      expect(result.fixtureInputStructure.errors).toHaveLength(0);

      expect(result.fixtureOutput.valid).toBe(true);
      expect(result.fixtureOutput.errors).toHaveLength(0);

      // Verify the generated query includes all the complex scenarios
      const generatedQuery = result.fixtureInputStructure.generatedQuery;

      // Should have different aliases from fragment spreads
      expect(generatedQuery).toContain('firstItemList: items');
      expect(generatedQuery).toContain('secondItemList: items');

      // Should have merged field selections
      expect(generatedQuery).toContain('mergedItemList: items');

      // Should have inline fragments for union types
      expect(generatedQuery).toContain('... on Item');
      expect(generatedQuery).toContain('... on Metadata');

      // Should have field with arguments and variable
      expect(generatedQuery).toContain('metafield(namespace: "custom", key: $customKey)');

      // Should have filtered items with variable
      expect(generatedQuery).toContain('filteredItems: items(first: $firstCount)');

      // Should have details field with itemId argument
      expect(generatedQuery).toContain('details(itemId: "gid://test/Item/6")');

      // Verify data was validated correctly
      expect(result.fixtureInputTypes.data?.data?.firstItemList).toEqual([{ id: 'gid://test/Item/1' }]);
      expect(result.fixtureInputTypes.data?.data?.secondItemList).toEqual([{ id: 'gid://test/Item/2' }]);
      expect(result.fixtureInputTypes.data?.data?.mergedItemList).toEqual([{
        id: 'gid://test/Item/3',
        count: 10,
        details: { id: 'gid://test/Details/3' }
      }]);
      expect(result.fixtureInputTypes.data?.data?.searchResults).toHaveLength(2);
      expect(result.fixtureInputTypes.data?.data?.moreSearchResults).toHaveLength(2);
    });

    it('should use actual variable values from fixture when present', async () => {
      const schema = await loadSchema('./test/fixtures/schemas/schema.graphql');
      const fixture = await loadFixture('./test/fixtures/data/valid/complete-test-with-variables.json');
      const inputQueryAST = await loadInputQuery('./test/fixtures/queries/valid/complete-test.graphql');

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });

      // All validations should pass
      expect(result.inputQuery.valid).toBe(true);
      expect(result.inputQuery.errors).toHaveLength(0);

      expect(result.fixtureInputTypes.valid).toBe(true);
      expect(result.fixtureInputTypes.errors).toHaveLength(0);

      expect(result.fixtureInputStructure.valid).toBe(true);
      expect(result.fixtureInputStructure.errors).toHaveLength(0);

      expect(result.fixtureOutput.valid).toBe(true);
      expect(result.fixtureOutput.errors).toHaveLength(0);

      // Verify fixture has extracted variables
      expect(fixture.inputQueryVariables).toBeDefined();
      expect(fixture.inputQueryVariables?.customKey).toBe('configuration');
      expect(fixture.inputQueryVariables?.firstCount).toBe(10);
    });

    it('should handle query with valid syntax but schema mismatch', async () => {
      const { schema, fixture } = await loadTestData();
      
      // Valid GraphQL syntax but fields that don't exist in our schema
      const mismatchQueryAST = await loadInputQuery('./test/fixtures/queries/invalid/wrong-fields.graphql');

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST: mismatchQueryAST
      });

      // Input query should be invalid due to schema mismatch
      expect(result.inputQuery.valid).toBe(false);
      expect(result.inputQuery.errors.length).toBe(2);
      expect(result.inputQuery.errors[0].message).toContain('Cannot query field "nonExistentField" on type "Item"');
      expect(result.inputQuery.errors[1].message).toContain('Cannot query field "invalidMetadataField" on type "Metadata"');

      expect(result.inputQuery.valid && result.fixtureInputTypes.valid && result.fixtureInputStructure.valid && result.fixtureOutput.valid).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid mutation name', async () => {
      const { schema, fixture, inputQueryAST } = await loadTestData();

      const result = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
        mutationName: 'nonExistentMutation',
        resultParameterName: 'result'
      });

      expect(result.inputQuery.valid && result.fixtureInputTypes.valid && result.fixtureInputStructure.valid && result.fixtureOutput.valid).toBeFalsy();
      expect(result.fixtureOutput.valid).toBe(false);
      expect(result.fixtureOutput.errors.length).toBe(1);
    });
  });
});
import { describe, it, expect, beforeAll } from 'vitest';
import { convertFixtureToQuery } from '../../src/utils/convert-fixture-to-query.ts';
import { loadFixture, FixtureData } from '../../src/wasm-testing-helpers.ts';

describe('convertFixtureToQuery', () => {
  let testFixture: FixtureData;

  beforeAll(async () => {
    testFixture = await loadFixture('./test/fixtures/valid-test-fixture.json');
  });

  describe('Basic Structure Conversion', () => {
    it('should convert simple object to query', () => {
      // Use a subset of the loaded fixture for this test
      const simpleFixture = {
        title: testFixture.expectedOutput.title,
        count: testFixture.expectedOutput.count
      };
      
      const query = convertFixtureToQuery(simpleFixture, 'data');
      
      expect(query).toBe('query { data { title count } }');
    });

    it('should handle nested objects', () => {
      const inputFixture = testFixture.input;

      const query = convertFixtureToQuery(inputFixture, 'input');
      
      expect(query).toBe('query { input { data { items { id count details { id name } } metadata { email } } } }');
    });
  });

  describe('Array Handling', () => {
    it('should handle arrays with objects', () => {
      const outputFixture = testFixture.expectedOutput;

      const query = convertFixtureToQuery(outputFixture, 'output');
      
      expect(query).toBe('query { output { title count items { name value } } }');
    });

    it('should handle empty arrays', () => {
      const modifiedOutput = {
        ...testFixture.expectedOutput,
        items: []
      };

      const query = convertFixtureToQuery(modifiedOutput, 'output');
      
      expect(query).toBe('query { output { title count items } }');
    });

    it('should handle arrays with scalar values', () => {
      // Add scalar array to loaded fixture data
      const fixtureWithTags = {
        ...testFixture.expectedOutput,
        tags: ["tag1", "tag2", "tag3"]
      };

      const query = convertFixtureToQuery(fixtureWithTags, 'data');
      
      expect(query).toBe('query { data { title count items { name value } tags } }');
    });
  });

  describe('Field Name Variations', () => {
    it('should handle different field names', () => {
      // Use just the title field from loaded fixture for this test
      const fixture = { title: testFixture.expectedOutput.title };
      
      const queryWithData = convertFixtureToQuery(fixture, 'data');
      const queryWithInput = convertFixtureToQuery(fixture, 'input');
      const queryWithOutput = convertFixtureToQuery(fixture, 'output');
      
      expect(queryWithData).toBe('query { data { title } }');
      expect(queryWithInput).toBe('query { input { title } }');
      expect(queryWithOutput).toBe('query { output { title } }');
    });

    it('should handle empty field name', () => {
      const inputFixture = testFixture.input;
      
      const query = convertFixtureToQuery(inputFixture, '');
      
      expect(query).toBe('query { data { items { id count details { id name } } metadata { email } } }');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const fixtureWithNull = {
        ...testFixture.expectedOutput,
        value: null,
        other: "test"
      };
      
      const query = convertFixtureToQuery(fixtureWithNull, 'data');

      expect(query).toBe('query { data { title count items { name value } value other } }');
    });

    it('should handle mixed data types', () => {
      const fixtureWithMixedTypes = {
        ...testFixture.expectedOutput,
        string: "text",
        number: 123,
        boolean: true,
        object: {
          nested: "value"
        },
        array: [{ item: "test" }]
      };
      
      const query = convertFixtureToQuery(fixtureWithMixedTypes, 'data');
      
      expect(query).toBe('query { data { title count items { name value } string number boolean object { nested } array { item } } }');
    });

    it('should handle deeply nested structures', () => {
      const fixtureWithDeepNesting = {
        ...testFixture.expectedOutput,
        level1: {
          level2: {
            level3: {
              level4: {
                deepValue: "found"
              }
            }
          }
        }
      };
      
      const query = convertFixtureToQuery(fixtureWithDeepNesting, 'data');
      
      expect(query).toBe('query { data { title count items { name value } level1 { level2 { level3 { level4 { deepValue } } } } } }');
    });

    it('should handle empty objects', () => {
      const modifiedFixture = {
        ...testFixture.expectedOutput,
        emptyObject: {},
        normalField: "value"
      };
      
      const query = convertFixtureToQuery(modifiedFixture, 'data');
      
      expect(query).toBe('query { data { title count items { name value } emptyObject normalField } }');
    });
  });
});
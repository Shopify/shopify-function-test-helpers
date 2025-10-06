import { describe, it, expect } from 'vitest';
import { validateFixtureInputStructure } from '../../src/methods/validate-fixture-input-structure.ts';
import { loadInputQuery, loadFixture } from '../../src/wasm-testing-helpers.ts';
import { parse } from 'graphql';

describe('validateFixtureInputStructure', () => {
  it('should validate structure and generate query for basic fixture', async () => {
    const basicQuery = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');
    const basicFixture = await loadFixture('./test/fixtures/data/valid/basic.json');

    const result = validateFixtureInputStructure(basicQuery, basicFixture.input);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.generatedQuery).toBe('query { data { items { id count } metadata { email } } }');
    expect(result.normalizedData).toEqual(basicFixture.input);
  });

  it('should handle aliases and normalize data', async () => {
    const aliasedQuery = await loadInputQuery('./test/fixtures/queries/valid/aliased.graphql');
    const aliasedFixture = await loadFixture('./test/fixtures/data/valid/aliased.json');

    const result = validateFixtureInputStructure(aliasedQuery, aliasedFixture.input);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Normalized data should use actual field names, not aliases
    expect(result.normalizedData).toEqual({
      data: {
        items: [
          {
            id: 'gid://test/Item/1',
            count: 2
          }
        ],
        metadata: {
          email: 'test@example.com'
        }
      }
    });
  });

  it('should generate query with actual field names, not aliases', async () => {
    const aliasedQuery = await loadInputQuery('./test/fixtures/queries/valid/aliased.graphql');
    const aliasedFixture = await loadFixture('./test/fixtures/data/valid/aliased.json');

    const result = validateFixtureInputStructure(aliasedQuery, aliasedFixture.input);

    expect(result.valid).toBe(true);
    expect(result.generatedQuery).toBe('query { data { items { id count } metadata { email } } }');
    expect(result.normalizedData).toEqual({
      data: {
        items: [
          {
            id: 'gid://test/Item/1',
            count: 2
          }
        ],
        metadata: {
          email: 'test@example.com'
        }
      }
    });
  });

  it('should detect when fixture has extra fields', async () => {
    const basicQuery = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');
    const basicFixture = await loadFixture('./test/fixtures/data/valid/basic.json');

    const fixtureWithExtra = {
      ...basicFixture.input,
      data: {
        ...basicFixture.input.data,
        items: basicFixture.input.data.items.map((item: any) => ({
          ...item,
          extraField: 'not in query'
        }))
      }
    };

    const result = validateFixtureInputStructure(basicQuery, fixtureWithExtra);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('extraField'))).toBe(true);
  });

  it('should detect when fixture is missing required fields', async () => {
    const basicQuery = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');

    const fixtureWithMissing = {
      data: {
        items: [
          {
            id: 'gid://test/Item/1'
            // count field is missing
          }
        ],
        metadata: {
          email: 'test@example.com'
        }
      }
    };

    const result = validateFixtureInputStructure(basicQuery, fixtureWithMissing);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('count'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing'))).toBe(true);
  });

  describe('Fragments', () => {
    it('should validate inline fragments for union/interface types', async () => {
      const fragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/inline-fragments.graphql');
      const fragmentsFixture = await loadFixture('./test/fixtures/data/valid/inline-fragments.json');

      const result = validateFixtureInputStructure(fragmentsQuery, fragmentsFixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { data { searchResults { ... on Item { id count } ... on Metadata { email phone } } } }');
    });

    it('should validate named fragments for union/interface types', async () => {
      const namedFragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/named-fragments.graphql');
      const namedFragmentsFixture = await loadFixture('./test/fixtures/data/valid/named-fragments.json');

      const result = validateFixtureInputStructure(namedFragmentsQuery, namedFragmentsFixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { data { searchResults { ... on Item { id count } ... on Metadata { email phone } } } }');
      expect(result.normalizedData).toEqual({
        data: {
          searchResults: [
            { __typename: 'Item', id: 'gid://test/Item/1', count: 5 },
            { __typename: 'Metadata', email: 'test@example.com', phone: '555-1234' },
            { __typename: 'Item', id: 'gid://test/Item/2', count: 10 }
          ]
        }
      });
    });

    it('should detect when fixture has fields not in any fragment', async () => {
      const fragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/inline-fragments.graphql');

      const fixtureWithInvalidFields = {
        data: {
          searchResults: [
            { id: 'item-1', count: 5, invalidField: 'not in any fragment' }
          ]
        }
      };

      const result = validateFixtureInputStructure(fragmentsQuery, fixtureWithInvalidFields);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalidField'))).toBe(true);
    });

    it('should normalize data for fragments with correct field names', async () => {
      const fragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/inline-fragments.graphql');
      const fragmentsFixture = await loadFixture('./test/fixtures/data/valid/inline-fragments.json');

      const result = validateFixtureInputStructure(fragmentsQuery, fragmentsFixture.input);

      expect(result.normalizedData).toEqual({
        data: {
          searchResults: [
            { __typename: 'Item', id: 'gid://test/Item/1', count: 5 },
            { __typename: 'Metadata', email: 'test@example.com', phone: '555-1234' },
            { __typename: 'Item', id: 'gid://test/Item/2', count: 10 }
          ]
        }
      });
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should allow null values for fields', () => {
      const query = parse(`
        query {
          data {
            items {
              id
              count
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixture = {
        data: {
          items: [{ id: 'item-1', count: null }],
          metadata: { email: null }
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedData).toEqual({
        data: {
          items: [{ id: 'item-1', count: null }],
          metadata: { email: null }
        }
      });
    });

    it('should allow null values in arrays', () => {
      const query = parse(`
        query {
          data {
            items {
              id
              count
            }
          }
        }
      `);

      const fixture = {
        data: {
          items: [
            { id: 'item-1', count: 5 },
            null,
            { id: 'item-2', count: 10 }
          ]
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedData).toEqual({
        data: {
          items: [
            { id: 'item-1', count: 5 },
            null,
            { id: 'item-2', count: 10 }
          ]
        }
      });
    });
  });

  describe('Array Handling', () => {
    it('should validate empty arrays', () => {
      const query = parse(`
        query {
          data {
            items {
              id
            }
          }
        }
      `);

      const fixture = {
        data: {
          items: []
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { data { items { id } } }');
      expect(result.normalizedData).toEqual({
        data: {
          items: []
        }
      });
    });

    it('should detect errors in specific array items', () => {
      const query = parse(`
        query {
          items {
            id
            name
          }
        }
      `);

      const fixture = {
        items: [
          { id: 'item-1', name: 'Item 1' },
          { id: 'item-2', name: 'Item 2' },
          { id: 'item-3' } // Missing name
        ]
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('items[2]') && e.includes('name'))).toBe(true);
    });
  });

  describe('Deeply Nested Structures', () => {
    it('should validate deeply nested objects', () => {
      const query = parse(`
        query {
          level1 {
            level2 {
              level3 {
                level4 {
                  value
                }
              }
            }
          }
        }
      `);

      const fixture = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value'
              }
            }
          }
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedData).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value'
              }
            }
          }
        }
      });
    });

    it('should report errors at correct nesting level', () => {
      const query = parse(`
        query {
          level1 {
            level2 {
              level3 {
                value
              }
            }
          }
        }
      `);

      const fixture = {
        level1: {
          level2: {
            level3: {
              wrongField: 'value'
            }
          }
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('level1.level2.level3.wrongField'))).toBe(true);
      expect(result.errors.some(e => e.includes('level1.level2.level3.value'))).toBe(true);
    });
  });

  describe('Variables', () => {
    it('should include variable definitions in generated query', async () => {
      const variablesQuery = await loadInputQuery('./test/fixtures/queries/valid/with-variables.graphql');
      const variablesFixture = await loadFixture('./test/fixtures/data/valid/with-variables.json');

      const result = validateFixtureInputStructure(variablesQuery, variablesFixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Should include variable definitions
      expect(result.generatedQuery).toContain('query($itemId: ID!)');

      // Should include variables in field arguments
      expect(result.generatedQuery).toContain('details(itemId: $itemId)');

      // Full expected query
      expect(result.generatedQuery).toBe('query($itemId: ID!) { data { items { id count details(itemId: $itemId) { id name } } metadata { email } } }');

      expect(result.normalizedData).toEqual({
        data: {
          items: [
            {
              id: 'gid://test/Item/1',
              count: 5,
              details: {
                id: 'gid://test/ItemDetails/123',
                name: 'Item 1 Details'
              }
            }
          ],
          metadata: {
            email: 'test@example.com'
          }
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle query with only scalar fields at root', () => {
      const query = parse(`
        query {
          title
          count
          active
        }
      `);

      const fixture = {
        title: 'Test Title',
        count: 42,
        active: true
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { title count active }');
      expect(result.normalizedData).toEqual({
        title: 'Test Title',
        count: 42,
        active: true
      });
    });

    it('should fail when no query operation is found', () => {
      const mutation = parse(`
        mutation {
          updateItem {
            id
          }
        }
      `);

      const fixture = {
        updateItem: {
          id: 'item-1'
        }
      };

      const result = validateFixtureInputStructure(mutation, fixture);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No query operation found in AST');
    });

    it('should handle fixture with mixed data types', () => {
      const query = parse(`
        query {
          data {
            stringField
            numberField
            booleanField
            nullField
          }
        }
      `);

      const fixture = {
        data: {
          stringField: 'text',
          numberField: 123,
          booleanField: true,
          nullField: null
        }
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedData).toEqual({
        data: {
          stringField: 'text',
          numberField: 123,
          booleanField: true,
          nullField: null
        }
      });
    });
  });
});

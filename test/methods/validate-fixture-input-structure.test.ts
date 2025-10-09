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
  });

  it('should handle aliases in fixture and generate query with aliases', async () => {
    const aliasedQuery = await loadInputQuery('./test/fixtures/queries/valid/aliased.graphql');
    const aliasedFixture = await loadFixture('./test/fixtures/data/valid/aliased.json');

    const result = validateFixtureInputStructure(aliasedQuery, aliasedFixture.input);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Generated query preserves aliases
    expect(result.generatedQuery).toBe('query { data { itemList: items { itemId: id count } metadata { email } } }');
  });


  it('should handle same field selected multiple times with different aliases', async () => {
    const multiAliasQuery = await loadInputQuery('./test/fixtures/queries/valid/multiple-aliases-same-field.graphql');
    const multiAliasFixture = await loadFixture('./test/fixtures/data/valid/multiple-aliases-same-field.json');

    const result = validateFixtureInputStructure(multiAliasQuery, multiAliasFixture.input);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Generated query should include the field multiple times with aliases and different arguments
    expect(result.generatedQuery).toContain('metafield1: metafield(namespace: "$app:config", key: "setting1")');
    expect(result.generatedQuery).toContain('metafield2: metafield(namespace: "$app:config", key: "setting2")');
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

    it('should handle nested inline fragments', async () => {
      const nestedFragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/nested-inline-fragments.graphql');
      const nestedFragmentsFixture = await loadFixture('./test/fixtures/data/valid/nested-inline-fragments.json');

      const result = validateFixtureInputStructure(nestedFragmentsQuery, nestedFragmentsFixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { data { items { id count details { id name } } } }');
    });

    it('should validate named fragments for union/interface types', async () => {
      const namedFragmentsQuery = await loadInputQuery('./test/fixtures/queries/valid/named-fragments.graphql');
      const namedFragmentsFixture = await loadFixture('./test/fixtures/data/valid/named-fragments.json');

      const result = validateFixtureInputStructure(namedFragmentsQuery, namedFragmentsFixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.generatedQuery).toBe('query { data { searchResults { ... on Item { id count } ... on Metadata { email phone } } } }');
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

    it('should not report duplicate errors for first array item', () => {
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
          { id: 'item-1' }, // Missing name in first item
          { id: 'item-2', name: 'Item 2' }
        ]
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Query selects field "name" at path "items[0].name" but it is missing from the fixture');
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
    });

    it('should detect scalar value where object with fields is expected', () => {
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
        data: "scalar string instead of object"
      };

      const result = validateFixtureInputStructure(query, fixture);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Expected object with fields at path "data" but got scalar value');
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
      expect(result.errors).toEqual(['No query operation found in AST']);
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
    });
  });
});

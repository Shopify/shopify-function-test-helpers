import { describe, it, expect, beforeAll } from 'vitest';
import { validateFixtureInputTypes } from '../../src/methods/validate-fixture-input-types.ts';
import { loadFixture, loadSchema, loadInputQuery, FixtureData } from '../../src/wasm-testing-helpers.ts';
import { validateFixtureInputStructure } from '../../src/methods/validate-fixture-input-structure.ts';
import { GraphQLSchema, DocumentNode } from 'graphql';

describe('validateFixtureInputTypes', () => {
  let schema: GraphQLSchema;
  let fixture: FixtureData;
  let queryAST: DocumentNode;

  beforeAll(async () => {
    schema = await loadSchema('./test/fixtures/schemas/schema.graphql');
    fixture = await loadFixture('./test/fixtures/data/valid/basic.json');
    queryAST = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');
  });

  it('should validate input fixture types against original schema', async () => {
    const traversalResult = validateFixtureInputStructure(queryAST, fixture.input);
    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      fixture.input
    );

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('query');
    expect(result.valid).toBe(true);
  });

  it('should detect invalid fixture data types', async () => {
    const invalidInput = {
      data: {
        items: [{
          id: "gid://test/Item/1",
          count: "not_a_number" // Should be integer
        }],
        metadata: {
          email: "test@example.com"
        }
      }
    };

    const traversalResult = validateFixtureInputStructure(queryAST, invalidInput);

    // Structure validation should pass (right fields present)
    expect(traversalResult.valid).toBe(true);

    // But type validation should fail (wrong type for count)
    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      invalidInput
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Int cannot represent non-integer value');
    expect(result.errors[0]).toContain('"not_a_number"');
  });

  it('should handle empty arrays', async () => {
    const emptyArrayInput = {
      data: {
        items: [],
        metadata: {
          email: "test@example.com"
        }
      }
    };

    const traversalResult = validateFixtureInputStructure(queryAST, emptyArrayInput);
    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      emptyArrayInput
    );

    // The query structure is valid, so this should pass
    // Empty arrays are handled correctly by GraphQL
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle complex nested fixture data', async () => {
    const complexInput = {
      data: {
        items: [
          { id: "1", count: 1, details: { id: "d1", name: "Item 1" } },
          { id: "2", count: 2, details: { id: "d2", name: "Item 2" } },
          { id: "3", count: 3, details: { id: "d3", name: "Item 3" } }
        ],
        metadata: {
          email: "test@example.com"
        }
      }
    };

    const traversalResult = validateFixtureInputStructure(queryAST, complexInput);
    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      complexInput
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result).toHaveProperty('query');
    expect(result.query).toContain('metadata');
    expect(result.query).toContain('email');
  });

  it('should succeed when fixture uses aliased field names with queryAST', async () => {
    // Load the aliased query and fixture
    const aliasedQueryAST = await loadInputQuery('./test/fixtures/queries/valid/aliased.graphql');
    const aliasedFixture = await loadFixture('./test/fixtures/data/valid/aliased.json');

    // Traverse with the aliased query
    const traversalResult = validateFixtureInputStructure(aliasedQueryAST, aliasedFixture.input);

    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      aliasedFixture.input
    );

    // Should succeed because normalized data uses actual field names that GraphQL can resolve
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multiple aliases for same field using custom resolver', async () => {
    // Load the multiple-aliases query and fixture
    const multiAliasQueryAST = await loadInputQuery('./test/fixtures/queries/valid/multiple-aliases-same-field.graphql');
    const multiAliasFixture = await loadFixture('./test/fixtures/data/valid/multiple-aliases-same-field.json');

    // Traverse with the query
    const traversalResult = validateFixtureInputStructure(multiAliasQueryAST, multiAliasFixture.input);

    const result = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      multiAliasFixture.input
    );

    // Should succeed because custom resolver can look up aliases from original fixture data
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Verify that both aliased fields were resolved correctly in the result
    expect(result.data?.data?.metafield1).toEqual({
      type: 'json',
      value: '{"setting1":"value1"}'
    });
    expect(result.data?.data?.metafield2).toEqual({
      type: 'json',
      value: '{"setting2":"value2"}'
    });
  });
});
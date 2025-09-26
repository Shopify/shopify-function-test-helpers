import { describe, it, expect, beforeAll } from 'vitest';
import { validateInputQueryFixtureMatch, loadSchema, loadInputQuery, loadFixture } from '../../src/wasm-testing-helpers.ts';
import { GraphQLSchema } from 'graphql';

describe('validateInputQueryFixtureMatch', () => {
  let schema: GraphQLSchema;

  beforeAll(async () => {
    const schemaPath = './test/fixtures/test-schema.graphql';
    schema = await loadSchema(schemaPath);
  });

  it('should validate matching query and fixture', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const fixturePath = './test/fixtures/valid-test-fixture.json';
    
    const queryAST = await loadInputQuery(queryPath);
    const fixture = await loadFixture(fixturePath);

    const result = await validateInputQueryFixtureMatch(queryAST, fixture.input, schema);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing fields in fixture', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const fixturePath = './test/fixtures/incomplete-test-fixture.json';
    
    const queryAST = await loadInputQuery(queryPath);
    const fixture = await loadFixture(fixturePath);

    const result = await validateInputQueryFixtureMatch(queryAST, fixture.input, schema);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Query structure does not match fixture data structure');
  });

  it('should detect extra fields in fixture', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const fixturePath = './test/fixtures/extra-fields-test-fixture.json';
    
    const queryAST = await loadInputQuery(queryPath);
    const fixture = await loadFixture(fixturePath);

    const result = await validateInputQueryFixtureMatch(queryAST, fixture.input, schema);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Cannot query field');
  });

  it('should handle different query formatting identically', async () => {
    // Same logical query but different formatting
    const queryPath1 = './test/fixtures/test-query-compact.graphql';
    const queryPath2 = './test/fixtures/test-query-named.graphql';
    const fixturePath = './test/fixtures/valid-test-fixture.json';
    
    const queryAST1 = await loadInputQuery(queryPath1);
    const queryAST2 = await loadInputQuery(queryPath2);
    const fixture = await loadFixture(fixturePath);

    const result1 = await validateInputQueryFixtureMatch(queryAST1, fixture.input, schema);
    const result2 = await validateInputQueryFixtureMatch(queryAST2, fixture.input, schema);
    
    // Both should be valid despite different formatting and query names
    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
  });
});
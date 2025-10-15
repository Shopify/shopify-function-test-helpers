import { describe, it, expect } from 'vitest';
import { validateInputQuery, loadInputQuery, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateInputQuery', () => {
  it('should validate a valid GraphQL query against schema', async () => {
    const queryPath = './test/fixtures/queries/valid/basic.graphql';
    const schemaPath = './test/fixtures/schemas/schema.graphql';
    
    const queryAST = await loadInputQuery(queryPath);
    const schema = await loadSchema(schemaPath);
    
    const errors = validateInputQuery(queryAST, schema);
    
    expect(errors).toEqual([]);
  });

  it('should return validation errors for invalid GraphQL query', async () => {
    const queryPath = './test/fixtures/queries/invalid/wrong-fields.graphql';
    const schemaPath = './test/fixtures/schemas/schema.graphql';

    const queryAST = await loadInputQuery(queryPath);
    const schema = await loadSchema(schemaPath);

    const errors = validateInputQuery(queryAST, schema);

    expect(errors.length).toBe(2);

    // First error: nonExistentField on Item type
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Cannot query field "nonExistentField"');
    expect(errors[0].message).toContain('type "Item"');

    // Second error: invalidMetadataField on Metadata type
    expect(errors[1]).toHaveProperty('message');
    expect(errors[1].message).toContain('Cannot query field "invalidMetadataField"');
    expect(errors[1].message).toContain('type "Metadata"');
  });

  it('should return errors for invalid query string', async () => {
    // Since validateInputQuery expects an AST, invalid syntax should be caught at loadInputQuery level
    // This test verifies that loadInputQuery properly handles syntax errors
    await expect(loadInputQuery('./test/fixtures/queries/invalid/syntax-error.graphql')).rejects.toThrow();
  });

  it('should return errors for null schema', async () => {
    const queryAST = await loadInputQuery('./test/fixtures/queries/valid/basic.graphql');

    const errors = validateInputQuery(queryAST, null as any);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });

  it('should catch undefined fragment spreads', async () => {
    const queryPath = './test/fixtures/queries/invalid/undefined-fragment.graphql';
    const schemaPath = './test/fixtures/schemas/schema.graphql';

    const queryAST = await loadInputQuery(queryPath);
    const schema = await loadSchema(schemaPath);

    const errors = validateInputQuery(queryAST, schema);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Unknown fragment "UndefinedFragment"');
  });
});
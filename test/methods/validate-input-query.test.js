import { validateInputQuery, loadInputQuery, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateInputQuery', () => {
  it('should validate a valid GraphQL query against schema', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const queryAST = await loadInputQuery(queryPath);
    const schema = await loadSchema(schemaPath);
    
    const errors = validateInputQuery(queryAST, schema);
    
    expect(errors).toEqual([]);
  });

  it('should return validation errors for invalid GraphQL query', async () => {
    const queryPath = './test/fixtures/wrong-fields-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const queryAST = await loadInputQuery(queryPath);
    const schema = await loadSchema(schemaPath);
    
    const errors = validateInputQuery(queryAST, schema);
    
    expect(errors.length).toBe(3);
    expect(errors[0]).toHaveProperty('message');
  });

  it('should return errors for invalid query string', async () => {
    // Since validateInputQuery expects an AST, invalid syntax should be caught at loadInputQuery level
    // This test verifies that loadInputQuery properly handles syntax errors
    await expect(loadInputQuery('./test/fixtures/invalid-query.graphql')).rejects.toThrow();
  });

  it('should return errors for null schema', async () => {
    const queryAST = await loadInputQuery('./test/fixtures/test-query.graphql');
    
    const errors = validateInputQuery(queryAST, null);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });
});
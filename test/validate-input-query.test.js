const { validateInputQuery } = require('../src/methods/validate-fixture.js');

describe('validateInputQuery', () => {
  it('should validate a valid GraphQL query against schema', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const errors = await validateInputQuery(queryPath, schemaPath);
    
    expect(errors).toEqual([]);
  });

  it('should return validation errors for invalid GraphQL query', async () => {
    const queryPath = './test/fixtures/invalid-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const errors = await validateInputQuery(queryPath, schemaPath);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('message');
  });

  it('should return errors for invalid query file path', async () => {
    const queryPath = './nonexistent/query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const errors = await validateInputQuery(queryPath, schemaPath);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });

  it('should return errors for invalid schema file path', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const schemaPath = './nonexistent/schema.graphql';
    
    const errors = await validateInputQuery(queryPath, schemaPath);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });
});
const validateInputQuery = require('../../src/methods/validate-input-query.js');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('validateInputQuery', () => {
  it('should validate a valid GraphQL query against schema', async () => {
    const queryPath = './test/fixtures/test-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const queryString = await fs.readFile(queryPath, 'utf8');
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);
    
    const errors = validateInputQuery(queryString, schema);
    
    expect(errors).toEqual([]);
  });

  it('should return validation errors for invalid GraphQL query', async () => {
    const queryPath = './test/fixtures/wrong-fields-query.graphql';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const queryString = await fs.readFile(queryPath, 'utf8');
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);
    
    const errors = validateInputQuery(queryString, schema);
    
    expect(errors.length).toBe(3);
    expect(errors[0]).toHaveProperty('message');
  });

  it('should return errors for invalid query string', async () => {
    const invalidQueryString = 'invalid graphql syntax {{{';
    const schemaPath = './test/fixtures/test-schema.graphql';
    
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);
    
    const errors = validateInputQuery(invalidQueryString, schema);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });

  it('should return errors for null schema', async () => {
    const queryString = 'query { test }';
    
    const errors = validateInputQuery(queryString, null);
    
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toContain('Failed to validate query');
  });
});
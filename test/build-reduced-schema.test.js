const buildReducedSchema = require('../src/methods/build-reduced-schema.js');
const { buildSchema, printSchema } = require('graphql');
const fs = require('fs').promises;

describe('buildReducedSchema', () => {
  let schema;

  beforeAll(async () => {
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    schema = buildSchema(schemaString);
  });

  it('should build a reduced schema for CartValidationsGenerateRunResult', () => {
    const reducedSchema = buildReducedSchema('CartValidationsGenerateRunResult', schema);
    
    const typeMap = reducedSchema.getTypeMap();
    const typeNames = Object.keys(typeMap).filter(name => !name.startsWith('__'));
    
    // Should include the target type and its dependencies
    expect(typeNames).toContain('CartValidationsGenerateRunResult');
    expect(typeNames).toContain('Operation');
    expect(typeNames).toContain('ValidationAddOperation');
    expect(typeNames).toContain('ValidationError');
    
    // Should only contain required types (not the entire schema)
    expect(typeNames.length).toBeLessThan(50); // Original schema has hundreds of types
    
    console.log('\\n=== REDUCED SCHEMA FOR CartValidationsGenerateRunResult ===');
    console.log(`Types included: ${typeNames.length}`);
    console.log('Types:', typeNames.sort());
    console.log('\\n=== SCHEMA SDL ===');
    console.log(printSchema(reducedSchema));
  });

  it('should build a reduced schema for the MutationRoot type', () => {
    const reducedSchema = buildReducedSchema('MutationRoot', schema);
    
    const typeMap = reducedSchema.getTypeMap();
    const typeNames = Object.keys(typeMap).filter(name => !name.startsWith('__'));
    
    // MutationRoot should have many more dependencies
    expect(typeNames).toContain('MutationRoot');
    expect(typeNames).toContain('CartValidationsGenerateRunResult');
    expect(typeNames).toContain('Void');
    
    console.log('\\n=== REDUCED SCHEMA FOR MutationRoot ===');
    console.log(`Types included: ${typeNames.length}`);
    console.log('Sample types:', typeNames.slice(0, 10));
  });

  it('should throw error for non-existent type', () => {
    expect(() => {
      buildReducedSchema('NonExistentType', schema);
    }).toThrow("Type 'NonExistentType' not found in schema");
  });

  it('should handle scalar types', () => {
    const reducedSchema = buildReducedSchema('String', schema);
    
    const typeMap = reducedSchema.getTypeMap();
    const typeNames = Object.keys(typeMap).filter(name => !name.startsWith('__'));
    
    // Scalar types should include the scalar and Boolean (always included by GraphQL)
    expect(typeNames).toContain('String');
    
    console.log('\\n=== REDUCED SCHEMA FOR String (scalar) ===');
    console.log('Types:', typeNames);
  });
});
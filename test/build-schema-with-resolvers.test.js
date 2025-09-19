const { buildSchemaWithResolvers } = require('../src/methods/build-schema-with-resolvers');
const buildReducedSchema = require('../src/methods/build-reduced-schema');
const { buildSchema, graphql, isObjectType } = require('graphql');
const fs = require('fs').promises;

describe('buildSchemaWithResolvers', () => {
  let originalSchema;
  let reducedSchema;

  beforeAll(async () => {
    // Load the test-app schema
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    originalSchema = buildSchema(schemaString);
    
    // Create a reduced schema for testing
    reducedSchema = buildReducedSchema('CartValidationsGenerateRunResult', originalSchema);
  });

  it('should create executable schema with Query root type', () => {
    const executableSchema = buildSchemaWithResolvers('CartValidationsGenerateRunResult', reducedSchema);

    console.log('\\n=== EXECUTABLE SCHEMA CREATION ===');
    
    // Should have Query root type
    const queryType = executableSchema.getQueryType();
    expect(queryType).toBeTruthy();
    expect(queryType.name).toBe('Query');
    
    // Should have 'data' field in Query
    const queryFields = queryType.getFields();
    expect(queryFields).toHaveProperty('data');
    
    console.log('Query type created:', queryType.name);
    console.log('Query fields:', Object.keys(queryFields));
    
    expect(executableSchema).toBeTruthy();
    expect(typeof executableSchema.getQueryType).toBe('function');
  });

  it('should convert input type to output type', () => {
    const executableSchema = buildSchemaWithResolvers('CartValidationsGenerateRunResult', reducedSchema);
    
    // Get the data field type
    const queryType = executableSchema.getQueryType();
    const dataField = queryType.getFields().data;
    const dataFieldType = dataField.type;
    
    console.log('\\n=== INPUT TO OUTPUT TYPE CONVERSION ===');
    console.log('Original type name: CartValidationsGenerateRunResult (input)');
    console.log('Converted type name:', dataFieldType.name);
    console.log('Is output type:', isObjectType(dataFieldType));
    
    // Should be converted to output type with 'Output' suffix
    expect(dataFieldType.name).toBe('CartValidationsGenerateRunResultOutput');
    expect(isObjectType(dataFieldType)).toBe(true);
    
    // Should have the same fields as the input type
    const outputFields = dataFieldType.getFields();
    expect(outputFields).toHaveProperty('operations');
    
    console.log('Output type fields:', Object.keys(outputFields));
  });

  it('should create resolvers that return fixture data', async () => {
    const executableSchema = buildSchemaWithResolvers('CartValidationsGenerateRunResult', reducedSchema);
    
    // Test data that matches CartValidationsGenerateRunResult structure
    const testData = {
      operations: []
    };
    
    // Query needs to select subfields for complex types
    const query = `query { data { operations { validationAdd { errors { message target } } } } }`;
    
    const result = await graphql({
      schema: executableSchema,
      source: query,
      rootValue: { data: testData }
    });
    
    console.log('\\n=== RESOLVER FUNCTIONALITY TEST ===');
    console.log('Test query:', query);
    console.log('Root value:', JSON.stringify({ data: testData }, null, 2));
    console.log('Execution result:', JSON.stringify(result, null, 2));
    
    // Should execute without errors
    expect(result.errors).toBeFalsy();
    expect(result.data).toHaveProperty('data');
    expect(result.data.data).toHaveProperty('operations');
    expect(Array.isArray(result.data.data.operations)).toBe(true);
  });

  it('should handle non-existent target type', () => {
    expect(() => {
      buildSchemaWithResolvers('NonExistentType', reducedSchema);
    }).toThrow("Target type 'NonExistentType' not found in reduced schema");
    
    console.log('\\n=== ERROR HANDLING TEST ===');
    console.log('✓ Properly throws error for non-existent type');
  });

  it('should work with different target types', () => {
    // Test with another input type like ValidationError
    const validationErrorReducedSchema = buildReducedSchema('ValidationError', originalSchema);
    const validationErrorExecutableSchema = buildSchemaWithResolvers('ValidationError', validationErrorReducedSchema);
    
    const queryType = validationErrorExecutableSchema.getQueryType();
    const dataField = queryType.getFields().data;
    
    console.log('\\n=== DIFFERENT TARGET TYPE TEST ===');
    console.log('Target type: ValidationError (input type)');
    console.log('Generated output type:', dataField.type.name);
    console.log('Is converted to output type:', dataField.type.name.endsWith('Output'));
    
    expect(queryType).toBeTruthy();
    expect(dataField).toBeTruthy();
    expect(dataField.type.name).toBe('ValidationErrorOutput');
  });

  it('should preserve type descriptions and structure', () => {
    const executableSchema = buildSchemaWithResolvers('CartValidationsGenerateRunResult', reducedSchema);
    
    const queryType = executableSchema.getQueryType();
    const dataFieldType = queryType.getFields().data.type;
    const operationsField = dataFieldType.getFields().operations;
    
    console.log('\\n=== TYPE STRUCTURE PRESERVATION TEST ===');
    console.log('Operations field type:', operationsField.type.toString());
    
    // Should preserve field structure from original input type
    expect(operationsField).toBeTruthy();
    expect(operationsField.type.toString()).toMatch(/\[OperationOutput!\]!/);
    
    console.log('✓ Type structure preserved correctly');
  });
});
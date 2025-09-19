const { convertInputTypeToOutputType } = require('../src/methods/convert-input-type-to-output-type');
const { 
  buildSchema, 
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  isObjectType,
  isInputObjectType
} = require('graphql');
const fs = require('fs').promises;

describe('convertInputTypeToOutputType', () => {
  let schema;

  beforeAll(async () => {
    // Load the test-app schema for real-world testing
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    schema = buildSchema(schemaString);
  });

  describe('Basic Type Conversions', () => {
    it('should convert GraphQLInputObjectType to GraphQLObjectType', () => {
      const inputType = new GraphQLInputObjectType({
        name: 'TestInput',
        fields: {
          message: { type: GraphQLString },
          count: { type: GraphQLInt }
        }
      });

      const outputType = convertInputTypeToOutputType(inputType);

      console.log('\n=== INPUT TO OUTPUT TYPE CONVERSION ===');
      console.log('Input type name:', inputType.name);
      console.log('Output type name:', outputType.name);
      console.log('Input type constructor:', inputType.constructor.name);
      console.log('Output type constructor:', outputType.constructor.name);

      expect(outputType.name).toBe('TestInputOutput');
      expect(isObjectType(outputType)).toBe(true);
      expect(isInputObjectType(inputType)).toBe(true);
      expect(isInputObjectType(outputType)).toBe(false);

      const outputFields = outputType.getFields();
      expect(outputFields).toHaveProperty('message');
      expect(outputFields).toHaveProperty('count');
      expect(outputFields.message.type).toBe(GraphQLString);
      expect(outputFields.count.type).toBe(GraphQLInt);
    });

    it('should preserve scalar types unchanged', () => {
      expect(convertInputTypeToOutputType(GraphQLString)).toBe(GraphQLString);
      expect(convertInputTypeToOutputType(GraphQLInt)).toBe(GraphQLInt);

      console.log('\n=== SCALAR TYPE PRESERVATION ===');
      console.log('GraphQLString preserved:', convertInputTypeToOutputType(GraphQLString) === GraphQLString);
      console.log('GraphQLInt preserved:', convertInputTypeToOutputType(GraphQLInt) === GraphQLInt);
    });

    it('should handle NonNull wrappers', () => {
      const nonNullString = new GraphQLNonNull(GraphQLString);
      const result = convertInputTypeToOutputType(nonNullString);

      console.log('\n=== NON-NULL WRAPPER HANDLING ===');
      console.log('Input type:', nonNullString.toString());
      console.log('Output type:', result.toString());
      console.log('Is NonNull:', result.constructor.name === 'GraphQLNonNull');

      expect(result.constructor.name).toBe('GraphQLNonNull');
      expect(result.ofType).toBe(GraphQLString);
    });

    it('should handle List wrappers', () => {
      const listOfStrings = new GraphQLList(GraphQLString);
      const result = convertInputTypeToOutputType(listOfStrings);

      console.log('\n=== LIST WRAPPER HANDLING ===');
      console.log('Input type:', listOfStrings.toString());
      console.log('Output type:', result.toString());
      console.log('Is List:', result.constructor.name === 'GraphQLList');

      expect(result.constructor.name).toBe('GraphQLList');
      expect(result.ofType).toBe(GraphQLString);
    });

    it('should handle nested NonNull and List wrappers', () => {
      const complexType = new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)));
      const result = convertInputTypeToOutputType(complexType);

      console.log('\n=== NESTED WRAPPER HANDLING ===');
      console.log('Input type:', complexType.toString());
      console.log('Output type:', result.toString());

      expect(result.toString()).toBe('[String!]!');
      expect(result.constructor.name).toBe('GraphQLNonNull');
      expect(result.ofType.constructor.name).toBe('GraphQLList');
      expect(result.ofType.ofType.constructor.name).toBe('GraphQLNonNull');
      expect(result.ofType.ofType.ofType).toBe(GraphQLString);
    });
  });

  describe('Nested Object Conversions', () => {
    it('should convert nested input object types', () => {
      const nestedInputType = new GraphQLInputObjectType({
        name: 'NestedInput',
        fields: {
          value: { type: GraphQLString }
        }
      });

      const parentInputType = new GraphQLInputObjectType({
        name: 'ParentInput',
        fields: {
          nested: { type: nestedInputType },
          simple: { type: GraphQLString }
        }
      });

      const outputType = convertInputTypeToOutputType(parentInputType);

      console.log('\n=== NESTED OBJECT CONVERSION ===');
      console.log('Parent output type:', outputType.name);
      
      const outputFields = outputType.getFields();
      const nestedField = outputFields.nested;
      console.log('Nested field type:', nestedField.type.name);
      console.log('Nested field is object type:', isObjectType(nestedField.type));

      expect(outputType.name).toBe('ParentInputOutput');
      expect(nestedField.type.name).toBe('NestedInputOutput');
      expect(isObjectType(nestedField.type)).toBe(true);

      const nestedOutputFields = nestedField.type.getFields();
      expect(nestedOutputFields).toHaveProperty('value');
      expect(nestedOutputFields.value.type).toBe(GraphQLString);
    });

    it('should handle circular references with cache', () => {
      const typeA = new GraphQLInputObjectType({
        name: 'TypeA',
        fields: () => ({
          name: { type: GraphQLString },
          typeB: { type: typeB }
        })
      });

      const typeB = new GraphQLInputObjectType({
        name: 'TypeB',
        fields: () => ({
          value: { type: GraphQLInt },
          typeA: { type: typeA }
        })
      });

      const cache = new Map();
      const outputA = convertInputTypeToOutputType(typeA, cache);

      console.log('\n=== CIRCULAR REFERENCE HANDLING ===');
      console.log('Cache size:', cache.size);
      console.log('Output type A name:', outputA.name);
      
      const fieldsA = outputA.getFields();
      const typeBField = fieldsA.typeB;
      console.log('Type B field type:', typeBField.type.name);

      expect(outputA.name).toBe('TypeAOutput');
      expect(typeBField.type.name).toBe('TypeBOutput');
      expect(cache.size).toBe(2);

      // Test that the circular reference is properly resolved
      const fieldsB = typeBField.type.getFields();
      expect(fieldsB.typeA.type).toBe(outputA);
    });
  });

  describe('Real Schema Types', () => {
    it('should convert CartValidationsGenerateRunResult from test schema', () => {
      const inputType = schema.getType('CartValidationsGenerateRunResult');
      
      console.log('\n=== REAL SCHEMA TYPE CONVERSION ===');
      console.log('Original type name:', inputType.name);
      console.log('Is input type:', isInputObjectType(inputType));

      const outputType = convertInputTypeToOutputType(inputType);

      console.log('Converted type name:', outputType.name);
      console.log('Is output type:', isObjectType(outputType));

      expect(inputType.name).toBe('CartValidationsGenerateRunResult');
      expect(isInputObjectType(inputType)).toBe(true);
      expect(outputType.name).toBe('CartValidationsGenerateRunResultOutput');
      expect(isObjectType(outputType)).toBe(true);

      const outputFields = outputType.getFields();
      const inputFields = inputType.getFields();
      console.log('Input fields:', Object.keys(inputFields));
      console.log('Output fields:', Object.keys(outputFields));

      expect(Object.keys(outputFields)).toEqual(Object.keys(inputFields));
    });

    it('should convert ValidationError from test schema', () => {
      const inputType = schema.getType('ValidationError');
      const outputType = convertInputTypeToOutputType(inputType);

      console.log('\n=== VALIDATION ERROR TYPE CONVERSION ===');
      console.log('Original type:', inputType.name);
      console.log('Converted type:', outputType.name);

      expect(outputType.name).toBe('ValidationErrorOutput');
      expect(isObjectType(outputType)).toBe(true);

      const outputFields = outputType.getFields();
      expect(outputFields).toHaveProperty('message');
      expect(outputFields).toHaveProperty('target');

      console.log('Output fields:', Object.keys(outputFields));
    });

    it('should handle complex nested types from real schema', () => {
      const operationType = schema.getType('Operation');
      const outputType = convertInputTypeToOutputType(operationType);

      console.log('\n=== COMPLEX NESTED TYPE CONVERSION ===');
      console.log('Operation type converted to:', outputType.name);

      const outputFields = outputType.getFields();
      console.log('Operation output fields:', Object.keys(outputFields));

      expect(outputType.name).toBe('OperationOutput');
      expect(isObjectType(outputType)).toBe(true);

      // Should have validationAdd field converted
      if (outputFields.validationAdd) {
        const validationAddType = outputFields.validationAdd.type;
        console.log('ValidationAdd field type:', validationAddType.name);
        expect(validationAddType.name).toBe('ValidationAddOperationOutput');
      }
    });
  });

  describe('Field Resolvers', () => {
    it('should create resolvers that extract data from parent objects', () => {
      const inputType = new GraphQLInputObjectType({
        name: 'TestInput',
        fields: {
          message: { type: GraphQLString },
          count: { type: GraphQLInt }
        }
      });

      const outputType = convertInputTypeToOutputType(inputType);
      const fields = outputType.getFields();

      console.log('\n=== FIELD RESOLVER TESTING ===');

      // Test resolver functionality
      const testData = { message: 'Hello', count: 42 };
      const messageResult = fields.message.resolve(testData);
      const countResult = fields.count.resolve(testData);

      console.log('Test data:', testData);
      console.log('Message resolver result:', messageResult);
      console.log('Count resolver result:', countResult);

      expect(messageResult).toBe('Hello');
      expect(countResult).toBe(42);

      // Test null handling
      const nullResult = fields.message.resolve(null);
      console.log('Null parent resolver result:', nullResult);
      expect(nullResult).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    it('should return output types unchanged', () => {
      const objectType = new GraphQLObjectType({
        name: 'AlreadyOutputType',
        fields: {
          value: { type: GraphQLString }
        }
      });

      const result = convertInputTypeToOutputType(objectType);

      console.log('\n=== OUTPUT TYPE UNCHANGED ===');
      console.log('Input is output type:', isObjectType(objectType));
      console.log('Result is same object:', result === objectType);

      expect(result).toBe(objectType);
    });

    it('should handle empty input object types', () => {
      const emptyInputType = new GraphQLInputObjectType({
        name: 'EmptyInput',
        fields: {}
      });

      const outputType = convertInputTypeToOutputType(emptyInputType);

      console.log('\n=== EMPTY INPUT TYPE ===');
      console.log('Empty input type name:', emptyInputType.name);
      console.log('Empty output type name:', outputType.name);

      const outputFields = outputType.getFields();
      console.log('Output fields count:', Object.keys(outputFields).length);

      expect(outputType.name).toBe('EmptyInputOutput');
      expect(Object.keys(outputFields)).toHaveLength(0);
    });

    it('should preserve field descriptions', () => {
      const inputType = new GraphQLInputObjectType({
        name: 'DescribedInput',
        description: 'An input type with descriptions',
        fields: {
          field1: { 
            type: GraphQLString, 
            description: 'First field description'
          }
        }
      });

      const outputType = convertInputTypeToOutputType(inputType);

      console.log('\n=== DESCRIPTION PRESERVATION ===');
      console.log('Input type description:', inputType.description);
      console.log('Output type description:', outputType.description);

      const outputFields = outputType.getFields();
      console.log('Field1 description:', outputFields.field1.description);

      expect(outputType.description).toBe('An input type with descriptions');
      expect(outputFields.field1.description).toBe('First field description');
    });
  });
});
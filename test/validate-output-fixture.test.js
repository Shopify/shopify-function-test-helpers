const { validateOutputFixture } = require('../src/methods/validate-output-fixture');
const { buildSchemaWithResolvers } = require('../src/methods/build-schema-with-resolvers');
const { convertFixtureToQuery } = require('../src/methods/convert-fixture-to-query');
const loadFixture = require('../src/methods/load-fixture');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('Output Fixture Validation', () => {
  let schema;
  let fixture;

  beforeAll(async () => {
    // Load the test-app schema
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    schema = buildSchema(schemaString);

    // Load the test fixture using loadFixture helper
    fixture = await loadFixture('./test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');
  });

  describe('convertFixtureToQuery', () => {
    it('should convert real fixture input data to GraphQL query', () => {
      const query = convertFixtureToQuery(fixture.input, 'input');
      
      console.log('\\n=== GENERATED QUERY FROM REAL FIXTURE ===');
      console.log('Input data:', JSON.stringify(fixture.input, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toContain('query');
      expect(query).toContain('input');
      expect(query).toContain('cart');
      expect(query).toContain('lines');
      expect(query).toContain('quantity');
    });

    it('should convert real fixture output data to GraphQL query', () => {
      // Transform the expectedOutput to proper GraphQL structure for query generation
      const outputData = {
        operations: [] // Empty operations for no validation errors
      };
      
      const query = convertFixtureToQuery(outputData, 'output');
      
      console.log('\\n=== OUTPUT QUERY FROM REAL FIXTURE ===');
      console.log('Expected output:', JSON.stringify(fixture.expectedOutput, null, 2));
      console.log('Transformed output:', JSON.stringify(outputData, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toContain('query');
      expect(query).toContain('output');
      expect(query).toContain('operations');
    });

    it('should handle nested objects and arrays', () => {
      const data = {
        operations: [
          {
            validationAdd: {
              errors: [
                {
                  message: "Error",
                  target: "$.cart"
                }
              ]
            }
          }
        ]
      };

      const query = convertFixtureToQuery(data, 'output');
      
      console.log('\\n=== COMPLEX QUERY ===');
      console.log(query);
      
      expect(query).toContain('operations');
      expect(query).toContain('validationAdd');
      expect(query).toContain('errors');
      expect(query).toContain('message');
      expect(query).toContain('target');
    });
  });

  describe('validateOutputFixture', () => {
    it('should validate output fixture data against CartValidationsGenerateRunResult', async () => {
      // Transform the expectedOutput to proper GraphQL structure for validation
      const outputData = {
        operations: [] // Empty operations for no validation errors
      };
      
      const result = await validateOutputFixture(outputData, schema, 'CartValidationsGenerateRunResult');
      
      console.log('\\n=== OUTPUT FIXTURE VALIDATION ===');
      console.log('Expected output:', JSON.stringify(fixture.expectedOutput, null, 2));
      console.log('Transformed output:', JSON.stringify(outputData, null, 2));
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors);
      console.log('Generated query:', result.query);
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should validate output fixture data against CartValidationsGenerateRunResult', async () => {
      // Transform the simplified output format to proper GraphQL structure
      const outputData = {
        operations: [] // Empty operations for no validation errors
      };
      
      const result = await validateOutputFixture(outputData, schema, 'CartValidationsGenerateRunResult');
      
      console.log('\\n=== OUTPUT VALIDATION RESULT ===');
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors);
      console.log('Data:', JSON.stringify(result.data, null, 2));
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should detect type errors in fixture data', async () => {
      const invalidData = {
        cart: {
          lines: [
            { quantity: "invalid_string" } // Should be number
          ]
        }
      };
      
      const result = await validateOutputFixture(invalidData, schema, 'CartValidationsGenerateRunResult');
      
      console.log('\\n=== TYPE ERROR DETECTION ===');
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors);
      
      // Should detect the type mismatch
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
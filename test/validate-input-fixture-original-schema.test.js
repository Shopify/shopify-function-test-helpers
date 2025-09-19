const { validateInputFixtureWithOriginalSchema } = require('../src/methods/validate-input-fixture-original-schema');
const loadFixture = require('../src/methods/load-fixture');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('validateInputFixtureWithOriginalSchema', () => {
  let schema;
  let fixture;

  beforeAll(async () => {
    // Load the test-app schema
    const schemaString = await fs.readFile('./test-app/extensions/cart-validation-js/schema.graphql', 'utf8');
    schema = buildSchema(schemaString);

    // Load the test fixture using loadFixture helper
    fixture = await loadFixture('./test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');
  });

  it('should validate input fixture against original schema', async () => {
    const result = await validateInputFixtureWithOriginalSchema(fixture.input, schema);

    console.log('\\n=== INPUT FIXTURE VALIDATION WITH ORIGINAL SCHEMA ===');
    console.log('Input data:', JSON.stringify(fixture.input, null, 2));
    console.log('Generated query:', result.query);
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);
    console.log('Result data keys:', result.data ? Object.keys(result.data) : 'No data');
    
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('query');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should detect invalid fixture data', async () => {
    const invalidInput = {
      cart: {
        lines: [
          { quantity: "not_a_number" } // Should be integer
        ]
      }
    };

    const result = await validateInputFixtureWithOriginalSchema(invalidInput, schema);

    console.log('\\n=== INVALID INPUT DETECTION ===');
    console.log('Invalid input:', JSON.stringify(invalidInput, null, 2));
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle missing required fields', async () => {
    const incompleteInput = {
      // Missing cart field entirely
    };

    const result = await validateInputFixtureWithOriginalSchema(incompleteInput, schema);

    console.log('\\n=== MISSING FIELDS DETECTION ===');
    console.log('Incomplete input:', JSON.stringify(incompleteInput, null, 2));
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle complex nested fixture data', async () => {
    const complexInput = {
      cart: {
        lines: [
          { quantity: 1 },
          { quantity: 2 },
          { quantity: 3 }
        ],
        buyerIdentity: {
          email: "test@example.com"
        }
      }
    };

    const result = await validateInputFixtureWithOriginalSchema(complexInput, schema);

    console.log('\\n=== COMPLEX NESTED DATA VALIDATION ===');
    console.log('Complex input:', JSON.stringify(complexInput, null, 2));
    console.log('Generated query:', result.query);
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('query');
    expect(result.query).toContain('buyerIdentity');
    expect(result.query).toContain('email');
  });
});
const { validateFixtureInput } = require('../../src/methods/validate-fixture-input');
const loadFixture = require('../../src/methods/load-fixture');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('validateFixtureInput', () => {
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
    const result = await validateFixtureInput(fixture.input, schema);
    
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

    const result = await validateFixtureInput(invalidInput, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('should handle missing required fields', async () => {
    const incompleteInput = {
      // Missing cart field entirely
    };

    const result = await validateFixtureInput(incompleteInput, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
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

    const result = await validateFixtureInput(complexInput, schema);

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('query');
    expect(result.query).toContain('buyerIdentity');
    expect(result.query).toContain('email');
  });
});
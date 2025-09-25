import { validateFixtureInput } from '../../src/methods/validate-fixture-input.ts';
import { loadFixture, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateFixtureInput', () => {
  let schema;
  let fixture;

  beforeAll(async () => {
    schema = await loadSchema('./test/fixtures/test-schema.graphql');
    fixture = await loadFixture('./test/fixtures/valid-test-fixture.json');
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
      data: {
        items: [
          { count: "not_a_number" } // Should be integer
        ]
      }
    };

    const result = await validateFixtureInput(invalidInput, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('should handle missing required fields', async () => {
    const incompleteInput = {
      // Missing data field entirely
    };

    const result = await validateFixtureInput(incompleteInput, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('should handle complex nested fixture data', async () => {
    const complexInput = {
      data: {
        items: [
          { count: 1 },
          { count: 2 },
          { count: 3 }
        ],
        metadata: {
          email: "test@example.com"
        }
      }
    };

    const result = await validateFixtureInput(complexInput, schema);

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('query');
    expect(result.query).toContain('metadata');
    expect(result.query).toContain('email');
  });
});
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { validateQueryFixtureMatch, loadSchema } from '../../src/wasm-testing-helpers.ts';

describe('validateQueryFixtureMatch', () => {
  let schema;

  beforeAll(async () => {
    const schemaPath = path.join(process.cwd(), 'test-app/extensions/cart-validation-js/schema.graphql');
    schema = await loadSchema(schemaPath);
  });

  it('should validate matching query and fixture', async () => {
    const query = `
      query CartValidationsGenerateRunInput {
        cart {
          lines {
            quantity
          }
        }
        buyerJourney {
          step
        }
      }
    `;

    const fixtureData = {
      cart: {
        lines: [
          {
            quantity: 1
          },
          {
            quantity: 1
          }
        ]
      },
      buyerJourney: {
        step: "CART_INTERACTION"
      }
    };

    const result = await validateQueryFixtureMatch(query, fixtureData, schema);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing fields in fixture', async () => {
    const query = `
      query CartValidationsGenerateRunInput {
        cart {
          lines {
            quantity
          }
        }
        buyerJourney {
          step
        }
      }
    `;

    const fixtureData = {
      cart: {
        lines: [
          {
            quantity: 1
          }
        ]
      }
      // Missing buyerJourney
    };

    const result = await validateQueryFixtureMatch(query, fixtureData, schema);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Query structure does not match fixture data structure');
  });

  it('should detect extra fields in fixture', async () => {
    const query = `
      query CartValidationsGenerateRunInput {
        cart {
          lines {
            quantity
          }
        }
      }
    `;

    const fixtureData = {
      cart: {
        lines: [
          {
            quantity: 1,
            id: "extra-field"  // Extra field not in query
          }
        ]
      },
      buyerJourney: {  // Extra top-level field
        step: "CART_INTERACTION"
      }
    };

    const result = await validateQueryFixtureMatch(query, fixtureData, schema);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Query structure does not match fixture data structure');
  });

  it('should handle different query formatting identically', async () => {
    // Same logical query but different formatting
    const query1 = `query { cart { lines { quantity } } buyerJourney { step } }`;
    const query2 = `
      query DifferentName {
        cart {
          lines {
            quantity
          }
        }
        buyerJourney {
          step
        }
      }
    `;

    const fixtureData = {
      cart: {
        lines: [{ quantity: 1 }]
      },
      buyerJourney: {
        step: "CART_INTERACTION"
      }
    };

    const result1 = await validateQueryFixtureMatch(query1, fixtureData, schema);
    const result2 = await validateQueryFixtureMatch(query2, fixtureData, schema);
    
    // Both should be valid despite different formatting and query names
    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
  });
});
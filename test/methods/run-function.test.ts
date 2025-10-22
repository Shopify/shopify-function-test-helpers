import { describe, it, expect } from 'vitest';
import { runFunction } from '../../src/methods/run-function.ts';
import { loadFixture } from '../../src/methods/load-fixture.ts';
import { FixtureData } from '../../src/methods/load-fixture.ts';

describe('runFunction', () => {
    it('should run a function using Shopify CLI', async () => {
      const fixture: FixtureData = {
        export: 'cart-validations-generate-run',
        input: {
          cart: {
            lines: [{ quantity: 1 }]
          }
        },
        expectedOutput: {},
        target: 'cart.validations.generate.run'
      };

      const result = await runFunction(fixture, 'test-app/extensions/cart-validation-js');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });

    it('should handle function execution errors gracefully', async () => {
      const fixture: FixtureData = {
        export: 'invalid_export',
        input: { cart: { lines: [] } },
        expectedOutput: {},
        target: 'cart.validations.generate.run'
      };

      const result = await runFunction(fixture, 'test-app/extensions/cart-validation-js');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });

    it('should work with fixture data', async () => {
      const fixture = await loadFixture('test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');

      const result = await runFunction(fixture, 'test-app/extensions/cart-validation-js');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });
  });
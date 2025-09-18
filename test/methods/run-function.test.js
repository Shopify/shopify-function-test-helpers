const runFunction = require('../../src/methods/run-function.js');
const loadFixture = require('../../src/methods/load-fixture.js');

  describe('runFunction', () => {
    it('should run a function using Shopify CLI', async () => {
      const exportName = 'cart-validations-generate-run';
      const input = {
        cart: {
          lines: [{ quantity: 1 }]
        }
      };
      
      const result = await runFunction(exportName, input, 'test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });

    it('should handle function execution errors gracefully', async () => {
      const exportName = 'invalid_export';
      const input = { cart: { lines: [] } };
      
      const result = await runFunction(exportName, input, 'test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });

    it('should work with fixture data', async () => {
      const fixture = await loadFixture('test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');
      
      const result = await runFunction(fixture.export, fixture.input, 'test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');
    });
  });
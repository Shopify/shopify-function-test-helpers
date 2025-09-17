const {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
} = require('../index.js');

describe('Shopify Functions WASM Testing Helpers', () => {
  describe('loadFixture', () => {
    it('should load fixture from a valid JSON file', async () => {
      const fixture = await loadFixture('test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');
      expect(fixture).toBeDefined();
      expect(fixture.export).toBe('cart-validations-generate-run');
      expect(fixture.target).toBe('cart.validations.generate.run');
      expect(fixture.input.cart).toBeDefined();
    });

    it('should throw an error for non-existent file', async () => {
      await expect(loadFixture('non-existent-file.json')).rejects.toThrow();
    });
  });

  describe('validateFixture', () => {
  });

  describe('buildFunction', () => {
    it('should build a function using Shopify CLI', async () => {
      const result = await buildFunction('test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('error');
    });
  });

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
});

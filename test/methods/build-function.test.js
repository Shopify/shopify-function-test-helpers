const buildFunction = require('../../src/methods/build-function.js');

  describe('buildFunction', () => {
    it('should build a function using Shopify CLI', async () => {
      const result = await buildFunction('test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('error');
    });
  });

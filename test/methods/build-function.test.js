import { buildFunction } from '../../src/methods/build-function.js';

  describe('buildFunction', () => {
    it('should build a function using Shopify CLI', async () => {
      const result = await buildFunction('test-app/extensions/cart-validation-js');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('error');
    }, 10000); // 10 second timeout for build operations
  });

const loadFixture = require('../../src/methods/load-fixture.js');

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

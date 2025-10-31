import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../src/methods/load-fixture.ts';

describe('loadFixture', () => {
    it('should load fixture from a valid JSON file', async () => {
      const fixture = await loadFixture('test-app/extensions/cart-validation-js/tests/fixtures/checkout-validation-valid-fixture.json');
      expect(fixture).toBeDefined();
      expect(fixture.export).toBe('cart-validations-generate-run');
      expect(fixture.target).toBe('cart.validations.generate.run');
      expect(fixture.input.cart).toBeDefined();
    });

    it('should load test fixture with input and output', async () => {
      const fixture = await loadFixture('./test/fixtures/valid-fixture.json');
      expect(fixture).toBeDefined();
      expect(fixture.export).toBe('test-data-processing');
      expect(fixture.target).toBe('data.processing.generate.run');
      expect(fixture.input).toBeDefined();
      expect(fixture.input.data).toBeDefined();
      expect(fixture.input.data.items).toHaveLength(1);
      expect(fixture.input.data.metadata).toBeDefined();
      expect(fixture.expectedOutput).toBeDefined();
      expect(fixture.expectedOutput.title).toBe('Test Processing Result');
      expect(fixture.expectedOutput.count).toBe(42);
      expect(fixture.expectedOutput.items).toHaveLength(2);
    });

    it('should throw an error for non-existent file', async () => {
      await expect(loadFixture('non-existent-file.json')).rejects.toThrow();
    });
  });

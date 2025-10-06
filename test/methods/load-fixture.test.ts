import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../src/methods/load-fixture.ts';

describe('loadFixture', () => {
    it('should load fixture from a valid JSON file', async () => {
      const fixture = await loadFixture('./test/fixtures/data/valid/basic.json');
      expect(fixture).toBeDefined();
      expect(fixture.export).toBe('test-data-processing');
      expect(fixture.target).toBe('data.processing.generate.run');
      expect(fixture.input).toBeDefined();
      expect(fixture.input.data).toBeDefined();
      expect(fixture.expectedOutput).toBeDefined();
    });

    it('should throw an error for non-existent file', async () => {
      await expect(loadFixture('non-existent-file.json')).rejects.toThrow();
    });
  });

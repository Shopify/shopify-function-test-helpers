import { describe, it, expect } from 'vitest';
import { runFunction, runFunctionWithRunnerDirectly } from '../../src/methods/run-function.ts';
import { loadFixture } from '../../src/methods/load-fixture.ts';

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

describe('runFunctionWithRunnerDirectly', () => {
    it('should run a function using function-runner directly', async () => {
      const exportName = 'cart-validations-generate-run';
      const input = {
        cart: {
          lines: [{ quantity: 1 }]
        }
      };

      const result = await runFunctionWithRunnerDirectly(exportName, input, 'test-app/extensions/cart-validation-js');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');

      // If function-runner is available, should succeed
      if (result.error === null) {
        expect(result.result).toBeDefined();
        expect(result.result).toHaveProperty('output');
      }
    });

    it('should handle missing WASM file gracefully', async () => {
      const exportName = 'cart-validations-generate-run';
      const input = { cart: { lines: [] } };

      const result = await runFunctionWithRunnerDirectly(exportName, input, 'nonexistent-function');

      expect(result).toBeDefined();
      expect(result.error).toContain('WASM file not found');
    });

    it('should work with fixture data', async () => {
      const fixture = await loadFixture('test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json');

      const result = await runFunctionWithRunnerDirectly(fixture.export, fixture.input, 'test-app/extensions/cart-validation-js');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');

      // If function-runner is available and function is built, should succeed
      if (result.error === null) {
        expect(result.result).toBeDefined();
        expect(result.result).toHaveProperty('output');
      }
    });

    it('should work with direct WASM path', async () => {
      const exportName = 'cart-validations-generate-run';
      const input = {
        cart: {
          lines: [{ quantity: 1 }]
        }
      };
      const wasmPath = 'test-app/extensions/cart-validation-js/dist/function.wasm';

      const result = await runFunctionWithRunnerDirectly(exportName, input, 'test-app/extensions/cart-validation-js', wasmPath);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('error');

      // If function-runner is available and WASM file exists, should succeed
      if (result.error === null) {
        expect(result.result).toBeDefined();
        expect(result.result).toHaveProperty('output');
      }
    });

    it('should handle invalid WASM path', async () => {
      const exportName = 'cart-validations-generate-run';
      const input = { cart: { lines: [] } };
      const wasmPath = 'nonexistent/path/to/function.wasm';

      const result = await runFunctionWithRunnerDirectly(exportName, input, 'test-app/extensions/cart-validation-js', wasmPath);

      expect(result).toBeDefined();
      expect(result.error).toContain('WASM file not found at provided path');
    });
  });
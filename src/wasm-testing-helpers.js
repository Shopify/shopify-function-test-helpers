/**
 * Shopify Functions WASM Testing Helpers
 * 
 * A library for testing Shopify Functions WASM modules, particularly
 * cart-checkout-validation functions.
 */

// Import all methods from separate files
import { loadFixture } from './methods/load-fixture.js';
import { validateFixture } from './methods/validate-fixture.js';
import { buildFunction } from './methods/build-function.js';
import { runFunction } from './methods/run-function.js';
import { loadSchema } from './methods/load-schema.js';

// Export all methods
export {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction,
  loadSchema
};
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

// Export types for consumers
export type { FixtureData } from './methods/load-fixture.js';
export type { BuildFunctionResult } from './methods/build-function.js';
export type { RunFunctionResult } from './methods/run-function.js';
export type { ValidationResult } from './methods/validate-fixture-input.js';
export type { OutputValidationResult } from './methods/validate-fixture-output.js';
export type { ValidateFixtureOptions, CompleteValidationResult } from './methods/validate-fixture.js';
export type { MutationTarget } from './utils/determine-mutation-from-target.js';
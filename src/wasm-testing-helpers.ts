/**
 * Shopify Functions WASM Testing Helpers
 * 
 * A library for testing Shopify Functions WASM modules, particularly
 * cart-checkout-validation functions.
 */

// Import all methods from separate files
import { loadFixture } from './methods/load-fixture.js';
import { loadSchema } from './methods/load-schema.js';
import { loadInputQuery } from './methods/load-input-query.js';
import { buildFunction } from './methods/build-function.js';
import { runFunction } from './methods/run-function.js';
import { validateTestAssets } from './methods/validate-test-assets.js';
import { validateInputQuery } from './methods/validate-input-query.js';
import { validateInputQueryFixtureMatch } from './methods/validate-input-query-fixture-match.js';
import { validateFixtureInput } from './methods/validate-fixture-input.js';
import { validateFixtureOutput } from './methods/validate-fixture-output.js';

// Export all methods
export {
  loadFixture,
  loadSchema,
  loadInputQuery,
  buildFunction,
  runFunction,
  validateTestAssets,
  validateInputQuery,
  validateInputQueryFixtureMatch,
  validateFixtureInput,
  validateFixtureOutput
};

// Export types for consumers
export type { FixtureData } from './methods/load-fixture.js';
export type { BuildFunctionResult } from './methods/build-function.js';
export type { RunFunctionResult } from './methods/run-function.js';
export type { ValidateTestAssetsOptions, CompleteValidationResult } from './methods/validate-test-assets.js';
export type { QueryFixtureMatchResult } from './methods/validate-input-query-fixture-match.js';
export type { ValidationResult } from './methods/validate-fixture-input.js';
export type { OutputValidationResult } from './methods/validate-fixture-output.js';
export type { MutationTarget } from './utils/determine-mutation-from-target.js';

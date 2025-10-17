/**
 * Shopify Functions WASM Testing Helpers
 *
 * A library for testing Shopify Functions WASM modules, particularly
 * cart-checkout-validation functions.
 */

// Import all methods from separate files
export { loadFixture } from "./methods/load-fixture.js";
export { loadSchema } from "./methods/load-schema.js";
export { loadInputQuery } from "./methods/load-input-query.js";
export { buildFunction } from "./methods/build-function.js";
export { runFunction } from "./methods/run-function.js";
export { validateTestAssets } from "./methods/validate-test-assets.js";
export { validateInputQuery } from "./methods/validate-input-query.js";
export { validateFixtureOutput } from "./methods/validate-fixture-output.js";
export { validateFixtureInput } from "./methods/validate-fixture-input.js";

// Export types for consumers
export type { FixtureData } from "./methods/load-fixture.js";
export type { BuildFunctionResult } from "./methods/build-function.js";
export type { RunFunctionResult } from "./methods/run-function.js";
export type {
  ValidateTestAssetsOptions,
  CompleteValidationResult,
} from "./methods/validate-test-assets.js";
export type { OutputValidationResult } from "./methods/validate-fixture-output.js";
export type { MutationTarget } from "./utils/determine-mutation-from-target.js";
export type { ValidateFixtureInputResult } from "./methods/validate-fixture-input.js";

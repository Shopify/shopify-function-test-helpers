/**
 * Shopify Functions WASM Testing Helpers
 * 
 * A library for testing Shopify Functions WASM modules, particularly
 * cart-checkout-validation functions.
 */

// Import all methods from separate files
const loadFixture = require('./methods/load-fixture');
const validateFixture = require('./methods/validate-fixture');
const buildFunction = require('./methods/build-function');
const runFunction = require('./methods/run-function');

// Export all methods
module.exports = {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
};
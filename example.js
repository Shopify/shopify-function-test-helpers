/**
 * Example usage of Shopify Functions WASM Testing Helpers
 */

const {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
} = require('./index.js');

async function runExample() {
  console.log('=== Shopify Functions WASM Testing Helpers Example ===\n');

// 1. Load a fixture from test data
console.log('1. Loading a fixture from test data...');
try {
  const fixture = loadFixture('20250915_184036_156Z_extensions_cart-checkout-validation_ba711d.json');
  console.log('Fixture loaded successfully');
  console.log('Export :', fixture.export);
  console.log('Input:', fixture.input);
  console.log('Expected Output:', fixture.expectedOutput);
  console.log('Target:', fixture.target);
  console.log('');
} catch (error) {
  console.log('Error loading fixture:', error.message);
  console.log('');
}

// 2. Validate a fixture
console.log('2. Validating a fixture...');
try {
  const fixture = loadFixture('20250915_184036_156Z_extensions_cart-checkout-validation_ba711d.json');
  const validation = validateFixture(fixture);
  
  console.log('Validation result:', validation.isValid ? 'VALID' : 'INVALID');
  if (!validation.isValid) {
    console.log('Validation errors:', validation.errors);
  }
  console.log('');
} catch (error) {
  console.log('Error validating fixture:', error.message);
  console.log('');
}

// 3. Build a function payload
console.log('3. Building a function payload...');
// You can provide a specific function path, or let it auto-detect
// const buildResult = await buildFunction('/path/to/your/function');
const buildResult = await buildFunction();

console.log('Function payload built successfully');
console.log('Build result:', buildResult);

// 4. Run a function
console.log('4. Running a function...');
// You can provide a specific function path, or let it auto-detect
// const result = await runFunction(fixture.export, fixture.input, '/path/to/your/function');
const result = await runFunction(fixture.export, fixture.input);

console.log('Function executed successfully');
console.log('Result status:', result.result.output.operations.length);
console.log('Output operations:', result.result.output.operations.length);

console.log('');
console.log('=== Example completed ===');
}

// Run the example
runExample().catch(console.error);

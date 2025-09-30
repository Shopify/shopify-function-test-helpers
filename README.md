# Shopify Functions WASM Testing Helpers

A JavaScript library that rpovides helpers for testing Shopify Functions WASM (WebAssembly) modules. This library provides four core utilities: `loadFixture`, `validateFixture`, `buildFunction`, and `runFunction`.

## Installation

```bash
npm install @shopify/shopify-function-test-helpers
```

## Usage

### Basic Usage

```javascript
const {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
} = require('@shopify/shopify-function-test-helpers');

// Load a fixture from test data
const fixture = loadFixture('20250915_184036_156Z_extensions_cart-checkout-validation_ba711d.json');

// Validate the fixture structure
const validation = validateFixture(fixture);
console.log('Is valid:', validation.isValid);

// Build a function
const payload = buildFunction();

// Run a function implementation

const result = runFunction(payload, mockFunction);
console.log('Result status:', result.status);
```

## API Reference

### Functions

#### `loadFixture(filename)`
Loads a fixture from the test_data directory.

**Parameters:**
- `filename`: Name of the fixture file

**Returns:** Fixture object

**Throws:** Error if fixture file is not found

#### `validateFixture(fixture)`
Validates a fixture to ensure it has the correct structure.

**Parameters:**
- `fixture`: The fixture data to validate

**Returns:** ValidationResult object with `isValid` boolean and `errors` array

#### `buildFunction(functionPath?)`
Builds a Shopify function using the Shopify CLI.

**Parameters:**
- `functionPath` (optional): Path to the function directory. If not provided, will auto-detect from current working directory.

**Returns:** Promise that resolves to build result object with `success`, `output`, and `error` properties.

#### `runFunction(exportName, input, functionPath?)`
Runs a Shopify function using the Shopify CLI.

**Parameters:**
- `exportName`: The export name of the function to run
- `input`: The input data to pass to the function
- `functionPath` (optional): Path to the function directory. If not provided, will auto-detect from current working directory.

**Returns:** Promise that resolves to result object with `result` and `error` properties.

**Note:** Both functions will automatically detect the function directory by looking for `shopify.function.toml` in common locations (current directory, src/, functions/, extensions/). You can also provide a specific path if needed.

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Submit a pull request

## Related

- [Tech Design](https://docs.google.com/document/d/1nmJge_seHPgJlzYgux6S90NEVPcYgn9uqimx9AXP_m8/edit?tab=t.0#heading=h.9zotah988fq7)

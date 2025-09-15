# Shopify Functions WASM Testing Helpers

A JavaScript library that rpovides helpers for testing Shopify Functions WASM (WebAssembly) modules. This library provides four core utilities: `loadFixture`, `validateFixture`, `buildFunction`, and `runFunction`.

## Installation

```bash
npm install shopify-functions-wasm-testing-helpers
```

## Usage

### Basic Usage

```javascript
const {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
} = require('shopify-functions-wasm-testing-helpers');

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

#### `buildFunction(cart, options?)`
Builds a function run payload from a cart and options.

**Parameters:**
- `cart`: Cart object to include in the payload
- `options` (optional): Configuration object
  - `shopId`: Shop ID (default: 1234)
  - `apiClientId`: API client ID (default: 5678)
  - `status`: Function run status (default: "success")
  - `source`: Function source (default: "cart-checkout-validation")
  - `storeName`: Store name (default: "test-shop.myshopify.com")
  - `functionId`: Function ID (default: "test-function-id")

**Returns:** Fixture object

#### `runFunction(payload, functionImplementation)`
Runs a function with the given payload and returns the result.

**Parameters:**
- `payload`: The function run payload
- `functionImplementation`: The actual function implementation to test

**Returns:** Fixture object with execution results

**Throws:** Error if functionImplementation is not a function

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

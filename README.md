# Shopify Functions WASM Testing Helpers

A JavaScript library that provides helpers for testing Shopify Functions WASM (WebAssembly) modules. This library provides utilities for loading fixtures, validating test assets, building functions, and running functions.

## Installation

```bash
npm install @shopify/shopify-function-test-helpers
```

## Usage

### Basic Usage

```javascript
import {
  buildFunction,
  loadFixture,
  loadSchema,
  loadInputQuery,
  validateTestAssets,
  runFunction,
} from "@shopify/shopify-function-test-helpers";

// Load the GraphQL schema and input query
const schema = await loadSchema("/path/to/schema.graphql");
const inputQueryAST = await loadInputQuery("/path/to/src/run.graphql");

// Load a test fixture
const fixture = await loadFixture("/path/to/fixtures/my-test.json");

// Build the function
await buildFunction("/path/to/function");

// Validate the test assets
const validationResult = await validateTestAssets({
  schema,
  fixture,
  inputQueryAST,
});

console.log(`  Input Query: ${validationResult.inputQuery.valid ? '✅' : '❌'}`);
console.log(`  Input Fixture: ${validationResult.inputFixture.valid ? '✅' : '❌'}`);
console.log(`  Input Query-Fixture Match: ${validationResult.inputQueryFixtureMatch.valid ? '✅' : '❌'}`);
console.log(`  Output Fixture: ${validationResult.outputFixture.valid ? '✅' : '❌'}`);

// Run the function
const runResult = await runFunction(
  fixture.export,
  fixture.input,
  "/path/to/function"
);

console.log("Output:", runResult.result.output);
console.log("Expected:", fixture.expectedOutput);
```

### Complete Test Example

For a full test suite that runs multiple fixtures:

```javascript
import path from "path";
import fs from "fs";
import {
  buildFunction,
  loadFixture,
  runFunction,
  validateTestAssets,
  loadSchema,
  loadInputQuery,
} from "@shopify/shopify-function-test-helpers";

describe("Function Tests", () => {
  let schema;
  let inputQueryAST;
  let functionDir;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    const schemaPath = path.join(functionDir, "schema.graphql");
    const inputQueryPath = path.join(functionDir, "src/run.graphql");

    schema = await loadSchema(schemaPath);
    inputQueryAST = await loadInputQuery(inputQueryPath);
  }, 20000);

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.basename(fixtureFile)}`, async () => {
      const fixture = await loadFixture(fixtureFile);

      const validationResult = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
      });

      expect(validationResult.inputQuery.valid).toBe(true);
      expect(validationResult.inputFixture.valid).toBe(true);
      expect(validationResult.inputQueryFixtureMatch.valid).toBe(true);
      expect(validationResult.outputFixture.valid).toBe(true);

      const runResult = await runFunction(
        fixture.export,
        fixture.input,
        functionDir
      );

      expect(runResult.error).toBeNull();
      expect(runResult.result.output).toEqual(fixture.expectedOutput);
    }, 10000);
  });
});
```

## API Reference

### Core Functions

- [`loadFixture`](./src/methods/load-fixture.ts) - Load a fixture file from the specified path
- [`loadSchema`](./src/methods/load-schema.ts) - Load a GraphQL schema from a file
- [`loadInputQuery`](./src/methods/load-input-query.ts) - Load and parse a GraphQL input query
- [`validateTestAssets`](./src/methods/validate-test-assets.ts) - Validate test assets including input query, fixture input/output, and query-fixture match
- [`buildFunction`](./src/methods/build-function.ts) - Build a Shopify function using the Shopify CLI
- [`runFunction`](./src/methods/run-function.ts) - Run a Shopify function using the Shopify CLI

See [wasm-testing-helpers.ts](./src/wasm-testing-helpers.ts) for all exported types.

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run example integration tests
npm run test:examples
```

### Building

```bash
npm run build
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

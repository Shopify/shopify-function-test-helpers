# Shopify Functions WASM Testing Helpers

[![CI](https://github.com/Shopify/shopify-function-test-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/Shopify/shopify-function-test-helpers/actions/workflows/ci.yml)

A JavaScript library that provides helpers for testing Shopify Functions WASM (WebAssembly) modules. This library provides utilities for loading fixtures, validating test assets, building functions, and running functions.

## Installation

```bash
npm install @shopify/shopify-function-test-helpers
```

Or with pnpm:

```bash
pnpm add @shopify/shopify-function-test-helpers
```

## Usage

### Complete Test Example

For a full test suite that runs multiple fixtures using `getFunctionInfo`:

```javascript
import path from "path";
import fs from "fs";
import {
  buildFunction,
  getFunctionInfo,
  loadFixture,
  runFunction,
  validateTestAssets,
  loadSchema,
  loadInputQuery,
} from "@shopify/shopify-function-test-helpers";

describe("Function Tests", () => {
  let schema;
  let functionDir;
  let functionInfo;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    // Get function information from Shopify CLI
    functionInfo = await getFunctionInfo(functionDir);

    // Load schema
    schema = await loadSchema(functionInfo.schemaPath);
  }, 20000);

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(\`runs \${path.basename(fixtureFile)}\`, async () => {
      const fixture = await loadFixture(fixtureFile);

      // Get the correct input query for this fixture's target
      const targetInputQueryPath = functionInfo.targeting[fixture.target].inputQueryPath;
      const inputQueryAST = await loadInputQuery(targetInputQueryPath);

      // Validate test assets
      const validationResult = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST,
      });

      expect(validationResult.inputQuery.errors).toHaveLength(0);
      expect(validationResult.inputFixture.errors).toHaveLength(0);
      expect(validationResult.outputFixture.errors).toHaveLength(0);

      // Run the function
      const runResult = await runFunction(
        fixture,
        functionInfo.functionRunnerPath,
        functionInfo.wasmPath,
        targetInputQueryPath,
        functionInfo.schemaPath
      );

      expect(runResult.error).toBeNull();
      expect(runResult.result.output).toEqual(fixture.expectedOutput);
    }, 10000);
  });
});
```

### Simplified Example (Without getFunctionInfo)

If you prefer to specify paths manually:

```javascript
import path from "path";
import {
  buildFunction,
  loadFixture,
  loadSchema,
  loadInputQuery,
  validateTestAssets,
  runFunction,
} from "@shopify/shopify-function-test-helpers";

describe("Function Tests", () => {
  beforeAll(async () => {
    const functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);
  }, 20000);

  test("validates and runs a fixture", async () => {
    const functionDir = path.dirname(__dirname);
    const schemaPath = path.join(functionDir, "schema.graphql");
    const inputQueryPath = path.join(functionDir, "src/run.graphql");

    const schema = await loadSchema(schemaPath);
    const inputQueryAST = await loadInputQuery(inputQueryPath);
    const fixture = await loadFixture("path/to/fixture.json");

    // Validate
    const validationResult = await validateTestAssets({
      schema,
      fixture,
      inputQueryAST,
    });

    expect(validationResult.inputQuery.errors).toHaveLength(0);
    expect(validationResult.inputFixture.errors).toHaveLength(0);
    expect(validationResult.outputFixture.errors).toHaveLength(0);

    // Run
    const runResult = await runFunction(
      fixture.export,
      fixture.input,
      functionDir
    );

    expect(runResult.error).toBeNull();
    expect(runResult.result.output).toEqual(fixture.expectedOutput);
  });
});
```

## API Reference

### Core Functions

- **[buildFunction](./src/methods/build-function.ts)** - Build a Shopify function using the Shopify CLI
- **[getFunctionInfo](./src/methods/get-function-info.ts)** - Get function information from Shopify CLI (paths, targets, etc.)
- **[loadFixture](./src/methods/load-fixture.ts)** - Load a test fixture file
- **[loadSchema](./src/methods/load-schema.ts)** - Load a GraphQL schema from a file
- **[loadInputQuery](./src/methods/load-input-query.ts)** - Load and parse a GraphQL input query
- **[validateTestAssets](./src/methods/validate-test-assets.ts)** - Validate test assets (input query, fixture input/output, query-fixture match)
- **[runFunction](./src/methods/run-function.ts)** - Run a Shopify function

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

### Create a tarball from a package 
```bash
npm run build
npm pack
```

This creates a `.tgz` file that can be installed in other projects:

```json
{
  "devDependencies": {
    "@shopify/shopify-function-test-helpers": "file:../path/to/shopify-shopify-function-test-helpers-0.0.1.tgz"
  }
}
```

## CI/CD

This project includes a comprehensive CI pipeline that runs on every push and pull request:

- **Lint & Type-check**: Ensures code quality and type safety
- **Tests**: Runs on multiple OS (Ubuntu, Windows, macOS) and Node versions (18.x, 20.x, 22.x)
- **Build**: Verifies the TypeScript compilation and creates the package

The CI configuration can be found in [.github/workflows/ci.yml](./.github/workflows/ci.yml).

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite (`npm test`)
6. Run the linter (`npm run lint`)
7. Submit a pull request

For more details, see the [test examples](./test-app/extensions/) in this repository.

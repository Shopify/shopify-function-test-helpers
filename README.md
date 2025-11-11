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
import { describe, beforeAll, test, expect } from "vitest";
import {
  buildFunction,
  getFunctionInfo,
  loadSchema,
  loadInputQuery,
  loadFixture,
  validateTestAssets,
  runFunction
} from "@shopify/shopify-function-test-helpers";

describe("Default Integration Test", () => {
  let schema;
  let functionDir;
  let schemaPath;
  let targeting;
  let functionRunnerPath;
  let wasmPath;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    const functionInfo = await getFunctionInfo(functionDir);
    ({ schemaPath, functionRunnerPath, wasmPath, targeting } = functionInfo);

    schema = await loadSchema(schemaPath);
  }, 45000);

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
      const fixture = await loadFixture(fixtureFile);
      const targetInputQueryPath = targeting[fixture.target].inputQueryPath;
      const inputQueryAST = await loadInputQuery(targetInputQueryPath);

      const validationResult = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });

      expect(validationResult.inputQuery.errors).toEqual([]);
      expect(validationResult.inputFixture.errors).toEqual([]);
      expect(validationResult.outputFixture.errors).toEqual([]);

      const runResult = await runFunction(
        fixture,
        functionRunnerPath,
        wasmPath,
        targetInputQueryPath,
        schemaPath
      );

      expect(runResult.error).toBeNull();
      expect(runResult.result.output).toEqual(fixture.expectedOutput);
    }, 10000);
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

### Building

```bash
pnpm build
```

### Linting

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix
```

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Create a tarball from a package

```bash
pnpm build
pnpm pack
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

## Creating a new release

This repo uses [Changesets](https://github.com/changesets/changesets) to manage releases.

### Adding a changeset

When making significant changes, generate a new changeset:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select the change type (patch, minor, or major)
2. Provide a description of your changes

Commit the generated changeset file (`.changeset/*.md`) with your PR.

### Release process

1. **When your PR merges to `main`**: The [release workflow](.github/workflows/release.yml) automatically creates or updates a "Version Packages" pull request.
2. **Version Packages PR**: Contains all unreleased changes from merged changesets, with updated version numbers and CHANGELOG entries.
3. **When the Version Packages PR merges**: The workflow publishes the new version to the npm registry.

### Modifying unreleased changes

To change or expand the contents of the next release:

1. Close the existing "Version Packages" PR.
2. The next commit to `main` will create a new "Version Packages" PR containing all unreleased changes (including the ones from the closed PR).

This allows you to add more changes or modify changeset descriptions before releasing.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite (`pnpm test`)
6. Run the linter (`pnpm lint`)
7. Submit a pull request

For more details, see the [test examples](./test-app/extensions/) in this repository.

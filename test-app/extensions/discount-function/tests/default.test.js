import path from "path";
import fs from "fs";
import { buildFunction, loadFixture, runFunction, validateTestAssets, loadSchema, loadInputQuery } from "@shopify/shopify-function-test-helpers";

function logValidationResults(fixtureFile, validationResult) {
  console.log(`Validation for ${path.basename(fixtureFile)}:`);
  console.log(`  Input Query: ${validationResult.inputQuery.valid ? '✅' : '❌'}`);
  console.log(`  Fixture Input Structure: ${validationResult.fixtureInputStructure.valid ? '✅' : '❌'}`);
  console.log(`  Fixture Input Types: ${validationResult.fixtureInputTypes.valid ? '✅' : '❌'}`);
  console.log(`  Fixture Output: ${validationResult.fixtureOutput.valid ? '✅' : '❌'}`);
  console.log(`  Overall: ${(validationResult.inputQuery.valid && validationResult.fixtureInputStructure.valid && validationResult.fixtureInputTypes.valid && validationResult.fixtureOutput.valid) ? '✅' : '❌'}`);
}

// File-level variables shared across all tests
let schema;
let inputQueryAST;
let functionDir;

// Build function once before all tests in this file
beforeAll(async () => {
  functionDir = path.dirname(__dirname);
  await buildFunction(functionDir);

  // Load schema and input query once since they don't change across fixtures
  const schemaPath = path.join(functionDir, "schema.graphql");
  const inputQueryPath = path.join(functionDir, "src/cart_lines_discounts_generate_run.graphql");

  schema = await loadSchema(schemaPath);
  inputQueryAST = await loadInputQuery(inputQueryPath);
}, 20000); // 20 second timeout for building the function

describe("Discount Function Tests", () => {

  describe("Valid Fixtures", () => {
    const fixturesDir = path.join(__dirname, "fixtures");
    const fixtureFiles = fs
      .readdirSync(fixturesDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(fixturesDir, file));

    fixtureFiles.forEach((fixtureFile) => {
      test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
        const fixture = await loadFixture(fixtureFile);

        // Validate fixture using our comprehensive validation system
        const validationResult = await validateTestAssets({
          schema,
          fixture,
          inputQueryAST
        });

        // Log validation results for debugging
        // logValidationResults(fixtureFile, validationResult);

        // Assert that all validation steps pass
        expect(validationResult.inputQuery.valid).toBe(true);
        expect(validationResult.fixtureInputStructure.valid).toBe(true);
        expect(validationResult.fixtureInputTypes.valid).toBe(true);
        expect(validationResult.fixtureOutput.valid).toBe(true);

        // Run the actual function
        const runResult = await runFunction(
          fixture.export,
          fixture.input,
          functionDir
        );

        const { result, error } = runResult;
        expect(error).toBeNull();
        expect(result.output).toEqual(fixture.expectedOutput);
      }, 10000);
    });
  });

  describe("Bad Fixture Formats", () => {
    const fixturesDir = path.join(__dirname, "fixtures", "bad-format");
    const fixtureFiles = fs
      .readdirSync(fixturesDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(fixturesDir, file));

    fixtureFiles.forEach((fixtureFile) => {
      test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
        const fixture = await loadFixture(fixtureFile);

        // Validate fixture using our comprehensive validation system
        const validationResult = await validateTestAssets({
          schema,
          fixture,
          inputQueryAST
        });

        // Log validation results for debugging
        logValidationResults(fixtureFile, validationResult);

        // For incorrectly formatted fixtures, validation should fail because the fixture
        // structure doesn't match the query (e.g., arguments in field keys)
        expect(validationResult.inputQuery.valid).toBe(true);
        expect(validationResult.fixtureInputStructure.valid).toBe(false);
        expect(validationResult.fixtureInputTypes.valid).toBe(true);
        expect(validationResult.fixtureOutput.valid).toBe(true);

        // Run the actual function
        const runResult = await runFunction(
          fixture.export,
          fixture.input,
          functionDir
        );

        const { result, error } = runResult;
        expect(error).toBeNull();

        // This should NOT match because the incorrect fixture format causes wrong behavior
        // The function can't read the metafield when arguments are in the key name
        expect(result.output).not.toEqual(fixture.expectedOutput);
      }, 10000);
    });
  });
});
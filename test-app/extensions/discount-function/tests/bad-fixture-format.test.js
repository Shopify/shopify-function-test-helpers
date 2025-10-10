import path from "path";
import fs from "fs";
import { buildFunction, loadFixture, runFunction, validateTestAssets, loadSchema, loadInputQuery } from "@shopify/shopify-function-test-helpers";

function logValidationResults(fixtureFile, validationResult) {
  console.log(`Validation for ${path.basename(fixtureFile)}:`);
  console.log(`  Input Query: ${validationResult.inputQuery.valid ? '✅' : '❌'}`);
  console.log(`  Input Fixture: ${validationResult.inputFixture.valid ? '✅' : '❌'}`);
  console.log(`  Input Query-Fixture Match: ${validationResult.inputQueryFixtureMatch.valid ? '✅' : '❌'}`);
  console.log(`  Output Fixture: ${validationResult.outputFixture.valid ? '✅' : '❌'}`);
  console.log(`  Overall: ${(validationResult.inputQuery.valid && validationResult.inputFixture.valid && validationResult.inputQueryFixtureMatch.valid && validationResult.outputFixture.valid) ? '✅' : '❌'}`);
}

describe("Bad Fixture Format Test", () => {
  let schema;
  let inputQueryAST;
  let functionDir;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    // Load schema and input query once since they don't change across fixtures
    const schemaPath = path.join(functionDir, "schema.graphql");
    const inputQueryPath = path.join(functionDir, "src/cart_lines_discounts_generate_run.graphql");

    schema = await loadSchema(schemaPath);
    inputQueryAST = await loadInputQuery(inputQueryPath);
  }, 10000); // 10 second timeout for building the function

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

      // For incorrectly formatted fixtures, validation should pass (because the GraphQL is valid)
      // but the function output will be wrong
      expect(validationResult.inputQuery.valid).toBe(true);
      expect(validationResult.inputFixture.valid).toBe(true);
      expect(validationResult.inputQueryFixtureMatch.valid).toBe(true);
      expect(validationResult.outputFixture.valid).toBe(true);

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

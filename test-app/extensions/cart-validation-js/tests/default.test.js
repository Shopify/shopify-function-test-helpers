import path from "path";
import fs from "fs";
import { buildFunction, loadFixture, runFunction, validateFixture } from "@shopify/functions-test-helpers";
import { buildSchema } from 'graphql';

function logValidationResults(fixtureFile, validationResult) {
  console.log(`Validation for ${path.basename(fixtureFile)}:`);
  console.log(`  Input Query: ${validationResult.inputQuery.valid ? '✅' : '❌'}`);
  console.log(`  Input Fixture: ${validationResult.inputFixture.valid ? '✅' : '❌'}`);
  console.log(`  Output Fixture: ${validationResult.outputFixture.valid ? '✅' : '❌'}`);
  console.log(`  Overall: ${(validationResult.inputQuery.valid && validationResult.inputFixture.valid && validationResult.outputFixture.valid) ? '✅' : '❌'}`);
}

describe("Default Integration Test", () => {
  let schema;
  let inputQueryString;
  let functionDir;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);
    
    // Load schema and input query once since they don't change across fixtures
    const schemaPath = path.join(functionDir, "schema.graphql");
    const inputQueryPath = path.join(functionDir, "src/cart_validations_generate_run.graphql");
    
    const schemaString = await fs.promises.readFile(schemaPath, 'utf8');
    schema = buildSchema(schemaString);
    inputQueryString = await fs.promises.readFile(inputQueryPath, 'utf8');
  }, 10000); // 10 second timeout for building the function

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
      const fixture = await loadFixture(fixtureFile);

      // Validate fixture using our comprehensive validation system
      const validationResult = await validateFixture({
        schema,
        fixture,
        inputQueryString
      });

      // Log validation results for debugging
      // logValidationResults(fixtureFile, validationResult);

      // Assert that all validation steps pass
      expect(validationResult.inputQuery.valid).toBe(true);
      expect(validationResult.inputFixture.valid).toBe(true);
      expect(validationResult.outputFixture.valid).toBe(true);

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
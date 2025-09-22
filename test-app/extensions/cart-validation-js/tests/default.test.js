const path = require("path");
const fs = require("fs");
const { buildFunction, loadFixture, runFunction, validateFixture } = require("../../../../src/wasm-testing-helpers");

describe("Default Integration Test", () => {
  beforeAll(async () => {
    const functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);
  }, 30000); // 30 second timeout for building the function

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
      const fixture = await loadFixture(fixtureFile);

      const functionDir = path.dirname(__dirname);

      const schemaPath = path.join(functionDir, "schema.graphql");
      const inputQueryPath = path.join(functionDir, "src/cart_validations_generate_run.graphql");

      // Validate fixture using our comprehensive validation system
      const validationResult = await validateFixture({
        schemaPath,
        fixturePath: fixtureFile,
        inputQueryPath,
        mutationName: 'cartValidationsGenerateRun',
        resultParameterName: 'result'
      });

      // Log validation results for debugging
      console.log(`Validation for ${path.basename(fixtureFile)}:`);
      console.log(`  Input Query: ${validationResult.inputQuery.valid ? '✅' : '❌'}`);
      console.log(`  Input Fixture: ${validationResult.inputFixture.valid ? '✅' : '❌'}`);
      console.log(`  Output Fixture: ${validationResult.outputFixture.valid ? '✅' : '❌'}`);
      console.log(`  Overall: ${validationResult.overall.valid ? '✅' : '❌'}`);

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
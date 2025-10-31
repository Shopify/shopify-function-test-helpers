import path from "path";
import fs from "fs";
import { buildFunction, loadFixture, runFunction, validateTestAssets, loadSchema, loadInputQuery, getFunctionInfo } from "@shopify/shopify-function-test-helpers";

describe("Default Integration Test", () => {
  let schema;
  let inputQueryAST;
  let functionDir;
  let schemaPath;
  let targeting;
  let functionRunnerPath;
  let wasmPath;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    // Get function info from Shopify CLI
    const functionInfo = await getFunctionInfo(functionDir);
    ({ schemaPath, functionRunnerPath, wasmPath, targeting } = functionInfo);

    schema = await loadSchema(schemaPath);
  }, 20000); // 20 second timeout for building and obtaining information about the function

  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(fixturesDir, file));

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
      const fixture = await loadFixture(fixtureFile);
      const inputQueryPath = targeting[fixture.target].inputQueryPath;
      inputQueryAST = await loadInputQuery(inputQueryPath);

      // Validate fixture using our comprehensive validation system
      const validationResult = await validateTestAssets({
        schema,
        fixture,
        inputQueryAST
      });
      expect(validationResult.inputQuery.errors).toHaveLength(0);
      expect(validationResult.inputFixture.errors).toHaveLength(0);
      expect(validationResult.outputFixture.errors).toHaveLength(0);

      // Run the actual function
      const runResult = await runFunction(
        fixture,
        functionRunnerPath,
        wasmPath,
        inputQueryPath,
        schemaPath
      );

      const { result, error } = runResult;
      expect(error).toBeNull();
      expect(result.output).toEqual(fixture.expectedOutput);
    }, 10000);
  });
});

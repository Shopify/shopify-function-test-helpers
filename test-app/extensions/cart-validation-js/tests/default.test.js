import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { buildFunction, loadFixture, runFunction, validateTestAssets, loadSchema, loadInputQuery } from "@shopify/shopify-function-test-helpers";

describe("Default Integration Test", () => {
  let schema;
  let inputQueryAST;
  let functionDir;
  let schemaPath;
  let inputQueryPath;
  let functionRunnerPath;
  let wasmPath;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);

    // Get function info from Shopify CLI
    let functionInfoJson;
    try {
      functionInfoJson = execSync(
        `shopify app function info --json --path ${functionDir}`,
        {
          encoding: 'utf-8'
        }
      );
    } catch (error) {
      // Check if the error is due to the command not being found
      if (error.message.includes('Command app function info not found')) {
        throw new Error(
          'The "shopify app function info" command is not available in your CLI version.\n' +
          'Please upgrade to the latest version:\n' +
          '  npm install -g @shopify/cli@latest\n\n'
        );
      }
      throw error;
    }

    const functionInfo = JSON.parse(functionInfoJson);
    schemaPath = functionInfo.functionSchemaPath;
    inputQueryPath = functionInfo.functionInputQueryPath;
    functionRunnerPath = functionInfo.functionRunnerPath;
    wasmPath = functionInfo.functionWasmPath;

    schema = await loadSchema(schemaPath);
    inputQueryAST = await loadInputQuery(inputQueryPath);
  }, 20000); // 20 second timeout for building the function

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

      // Assert that all validation steps pass
      expect(validationResult.inputQuery.errors).toHaveLength(0);
      expect(validationResult.inputFixture.errors).toHaveLength(0);
      expect(validationResult.outputFixture.errors).toHaveLength(0);

      // Run the actual function
      const runResult = await runFunction(
          functionRunnerPath,
          wasmPath,
          fixture,
          inputQueryPath,
          schemaPath
      );

      const { result, error } = runResult;
      expect(error).toBeNull();
      expect(result.output).toEqual(fixture.expectedOutput);
    }, 10000);
  });
});
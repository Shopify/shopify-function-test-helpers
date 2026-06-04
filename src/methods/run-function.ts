/**
 * Run a function with the given payload and return the result
 */

import { spawn } from "child_process";

import { FixtureData } from "./load-fixture.js";

/**
 * Metadata reported by function-runner for a function execution.
 */
export interface FunctionRunMetadata {
  instructionCount: number;
  memoryUsageKiB: number;
  moduleSizeKiB: number;
}

/**
 * Interface for the run function result
 */
export interface RunFunctionResult {
  result: { output: any } | null;
  metadata: FunctionRunMetadata | null;
  error: string | null;
}

function parseFunctionRunnerResult(stdout: string): {
  result: RunFunctionResult["result"];
  metadata: FunctionRunMetadata | null;
  error: string | null;
} {
  let result: unknown;

  try {
    result = JSON.parse(stdout);
  } catch (parseError) {
    // function-runner is not guaranteed to return JSON when it fails.
    return {
      result: null,
      metadata: null,
      error: `Failed to parse function-runner output: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
    };
  }

  const invalidShapeResult = {
    result: null,
    metadata: null,
    error: `function-runner returned unexpected format. Received: ${JSON.stringify(result)}`,
  };

  if (typeof result !== "object" || result === null) {
    return invalidShapeResult;
  }

  const resultObject = result as Record<string, unknown>;
  const {
    output,
    instructions,
    size: moduleSize,
    memory_usage: memoryUsage,
  } = resultObject;

  if (
    output === undefined ||
    typeof instructions !== "number" ||
    typeof memoryUsage !== "number" ||
    typeof moduleSize !== "number"
  ) {
    return invalidShapeResult;
  }

  return {
    result: { output },
    metadata: {
      instructionCount: instructions,
      memoryUsageKiB: memoryUsage,
      moduleSizeKiB: moduleSize,
    },
    error: null,
  };
}

/**
 * Run a function using Shopify CLI's function runner command
 *
 * This function:
 * - Uses function-runner binary directly to run the function.
 * @param {String} functionRunnerPath - Path to the function runner binary
 * @param {String} wasmPath - Path to the WASM file
 * @param {FixtureData} fixture - The fixture data containing export, input, and target
 * @param {String} queryPath - Path to the input query file
 * @param {String} schemaPath - Path to the schema file
 * @returns {Object} The function run result
 */

export async function runFunction(
  fixture: FixtureData,
  functionRunnerPath: string,
  wasmPath: string,
  queryPath: string,
  schemaPath: string,
): Promise<RunFunctionResult> {
  try {
    const inputJson = JSON.stringify(fixture.input);

    return new Promise((resolve) => {
      const runnerProcess = spawn(
        functionRunnerPath,
        [
          "-f",
          wasmPath,
          "--export",
          fixture.export,
          "--query-path",
          queryPath,
          "--schema-path",
          schemaPath,
          "--json",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";

      runnerProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      runnerProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      runnerProcess.on("close", (code) => {
        const functionRunnerResult = parseFunctionRunnerResult(stdout);

        if (code !== 0) {
          resolve({
            result: null,
            metadata: functionRunnerResult.metadata,
            error: `function-runner failed with exit code ${code}: ${stderr}`,
          });
          return;
        }

        resolve(functionRunnerResult);
      });

      runnerProcess.on("error", (error) => {
        resolve({
          result: null,
          metadata: null,
          error: `Failed to start function-runner: ${error.message}`,
        });
      });

      runnerProcess.stdin.write(inputJson);
      runnerProcess.stdin.end();
    });
  } catch (error) {
    if (error instanceof Error) {
      return {
        result: null,
        metadata: null,
        error: error.message,
      };
    } else {
      return {
        result: null,
        metadata: null,
        error: "Unknown error occurred",
      };
    }
  }
}

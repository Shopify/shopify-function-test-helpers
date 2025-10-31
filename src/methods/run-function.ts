/**
 * Run a function with the given payload and return the result
 */

import { spawn } from 'child_process';
import { FixtureData } from './load-fixture.js';

/**
 * Interface for the run function result
 */
export interface RunFunctionResult {
  result: { output: any } | null;
  error: string | null;
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
      const runnerProcess = spawn(functionRunnerPath, [
        '-f', wasmPath,
        '--export', fixture.export,
        '--query-path', queryPath,
        '--schema-path', schemaPath,
        '--json',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      runnerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      runnerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      runnerProcess.on('close', (code) => {

        if (code !== 0) {
          resolve({
            result: null,
            error: `function-runner failed with exit code ${code}: ${stderr}`
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);

          // function-runner output format: { output: {...} }
          if (!result.output) {
            resolve({
              result: null,
              error: `function-runner returned unexpected format - missing 'output' field. Received: ${JSON.stringify(result)}`
            });
            return;
          }

          resolve({
            result: { output: result.output },
            error: null
          });
        } catch (parseError) {
          resolve({
            result: null,
            error: `Failed to parse function-runner output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          });
        }
      });

      runnerProcess.on('error', (error) => {
        resolve({
          result: null,
          error: `Failed to start function-runner: ${error.message}`
        });
      });

      runnerProcess.stdin.write(inputJson);
      runnerProcess.stdin.end();
    });

  } catch (error) {
    if (error instanceof Error) {
      return {
        result: null,
        error: error.message
      };
    } else {
      return {
        result: null,
        error: 'Unknown error occurred',
      };
    }
  }
}

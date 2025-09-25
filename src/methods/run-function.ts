/**
 * Run a function with the given payload and return the result
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Interface for the run function result
 */
export interface RunFunctionResult {
  result: { output: any } | null;
  error: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run a function with the given payload and return the result
 * @param {String} exportName - The function run payload
 * @param {String} input - The actual function implementation to test
 * @param {String} [functionPath] - Optional path to the function directory
 * @returns {Object} The function run result
 */
export async function runFunction(
  exportName: string,
  input: Record<string, any>,
  functionPath?: string
): Promise<RunFunctionResult> {
  try {
    const inputJson = JSON.stringify(input);

    let functionDir, appRootDir, functionName;
    
    if (functionPath !== undefined && functionPath !== null) {
      // Use provided function path
      functionDir = path.resolve(functionPath);
      appRootDir = path.dirname(functionDir);
      functionName = path.basename(functionDir);
    } else {
      // Calculate paths correctly for when used as a dependency:
      // __dirname = /path/to/function/tests/node_modules/function-testing-helpers/src/methods
      // Go up 5 levels to get to function directory: ../../../../../ = /path/to/function
      functionDir = path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(__dirname)))));
      appRootDir = path.dirname(functionDir);
      functionName = path.basename(functionDir);
    }
    
    return new Promise((resolve, reject) => {
      const shopifyProcess = spawn('shopify', [
        'app', 'function', 'run',
        '--export', exportName,
        '--json',
        '--path', functionName
      ], {
        cwd: appRootDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      shopifyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      shopifyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      shopifyProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            result: null,
            error: `Command failed with exit code ${code}: ${stderr}`,
          });
          return;
        }

        let result;
        try {
          result = JSON.parse(stdout);

          let actualOutput;
          if (result?.output?.humanized) {
            actualOutput = JSON.parse(result.output.humanized);
          } else if (result?.output) {
            actualOutput = result.output;
          } else {
            actualOutput = result;
          }

          resolve({
            result: { output: actualOutput },
            error: null,
          });
        } catch (parseError) {
          resolve({
            result: { output: stdout.trim() },
            error: null,
          });
        }
      });

      shopifyProcess.on('error', (error) => {
        resolve({
          result: null,
          error: `Failed to start shopify command: ${error.message}`,
        });
      });

      shopifyProcess.stdin.write(inputJson);
      shopifyProcess.stdin.end();
    });

  } catch (error) {
    if (error instanceof Error) {
      return {
        result: null,
        error: error.message,
      };
    } else {
      return {
        result: null,
        error: 'Unknown error occurred',
      };
    }
  }
}


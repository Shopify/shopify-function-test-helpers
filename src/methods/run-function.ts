/**
 * Run a function with the given payload and return the result
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { parse as parseToml } from '@iarna/toml';
import { FixtureData } from './load-fixture.js';

/**
 * Interface for the run function result
 */
export interface RunFunctionResult {
  result: { output: any } | null;
  error: string | null;
  timing?: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}

/**
 * Run a function with the given fixture and return the result
 * @param {FixtureData} fixture - The fixture data containing export and input
 * @param {String} functionPath - Path to the function directory
 * @returns {Object} The function run result
 */
export async function runFunction(
  fixture: FixtureData,
  functionPath: string
): Promise<RunFunctionResult> {
  const startTime = Date.now();

  try {
    const inputJson = JSON.stringify(fixture.input);

    // Use provided function path
    const functionDir = path.resolve(functionPath);
    const appRootDir = path.dirname(functionDir);
    const functionName = path.basename(functionDir);

    return new Promise((resolve, reject) => {
      const shopifyProcess = spawn('shopify', [
        'app', 'function', 'run',
        '--export', fixture.export,
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
        const endTime = Date.now();
        const timing = {
          startTime,
          endTime,
          durationMs: endTime - startTime
        };

        if (code !== 0) {
          resolve({
            result: null,
            error: `Command failed with exit code ${code}: ${stderr}`,
            timing
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
            timing
          });
        } catch (parseError) {
          resolve({
            result: { output: stdout.trim() },
            error: null,
            timing
          });
        }
      });

      shopifyProcess.on('error', (error) => {
        const endTime = Date.now();
        resolve({
          result: null,
          error: `Failed to start shopify command: ${error.message}`,
          timing: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        });
      });

      shopifyProcess.stdin.write(inputJson);
      shopifyProcess.stdin.end();
    });

  } catch (error) {
    const endTime = Date.now();
    if (error instanceof Error) {
      return {
        result: null,
        error: error.message,
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    } else {
      return {
        result: null,
        error: 'Unknown error occurred',
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    }
  }
}

/**
 * Run a function using Shopify CLI's function runner command
 *
 * This function:
 * - Uses `shopify app function runner` which wraps function-runner
 * - Parses shopify.extension.toml to find the extension matching the fixture's target
 * - Extracts the WASM build path and input_query path from the matching extension
 * - Falls back to common locations if TOML parsing fails or no match is found
 * - Typically faster than runFunction() as it bypasses function build/run orchestration
 *
 * @param {FixtureData} fixture - The fixture data containing export, input, and target
 * @param {String} functionPath - Path to the function directory
 * @returns {Object} The function run result
 */

export async function runFunctionRunner(
  fixture: FixtureData,
  functionPath: string
): Promise<RunFunctionResult> {
  const startTime = Date.now();

  try {
    const inputJson = JSON.stringify(fixture.input);

    // Use provided function path
    const functionDir = path.resolve(functionPath);
    const functionName = path.basename(functionDir);
    const appRootDir = path.dirname(functionDir);

    // Parse shopify.extension.toml once to get all needed values
    let resolvedWasmPath: string | null = null;
    let schemaPath = path.join(functionDir, 'schema.graphql');
    let queryPath = path.join(functionDir, 'src', `${fixture.export}.graphql`);

    // Try to read from shopify.extension.toml and match by target
    const tomlPath = path.join(functionDir, 'shopify.extension.toml');
    if (fs.existsSync(tomlPath)) {
      try {
        const tomlContent = fs.readFileSync(tomlPath, 'utf-8');
        const config = parseToml(tomlContent) as any;

        // Look for extensions with matching target
        if (config.extensions && Array.isArray(config.extensions)) {
          for (const ext of config.extensions) {
            // Check if this extension has a targeting section that matches the fixture target
            if (ext.targeting && Array.isArray(ext.targeting)) {
              for (const targeting of ext.targeting) {
                if (targeting.target === fixture.target) {
                  // Found matching target, extract all needed paths
                  if (ext.build && ext.build.path) {
                    const tomlWasmPath = path.join(functionDir, ext.build.path);
                    if (fs.existsSync(tomlWasmPath)) {
                      resolvedWasmPath = tomlWasmPath;
                    }
                  }

                  // Get input_query path from targeting
                  if (targeting.input_query) {
                    queryPath = path.join(functionDir, targeting.input_query);
                  }

                  break;
                }
              }
            }

            if (resolvedWasmPath) break;
          }

          // If no matching target found, fall back to first extension with build.path
          if (!resolvedWasmPath) {
            for (const ext of config.extensions) {
              if (ext.build && ext.build.path) {
                const tomlWasmPath = path.join(functionDir, ext.build.path);
                if (fs.existsSync(tomlWasmPath)) {
                  resolvedWasmPath = tomlWasmPath;
                  break;
                }
              }
            }
          }
        }
      } catch (tomlError) {
        // If TOML parsing fails, fall through to default search
      }
    }

    // If not found in TOML, check common locations
    if (!resolvedWasmPath) {
      // Check Rust build output location
      const rustWasmPath = path.join(functionDir, 'target', 'wasm32-wasip1', 'release', `${functionName}.wasm`);
      if (fs.existsSync(rustWasmPath)) {
        resolvedWasmPath = rustWasmPath;
      } else {
        // Check dist folder (JavaScript functions)
        const distWasmPath = path.join(functionDir, 'dist', 'function.wasm');
        if (fs.existsSync(distWasmPath)) {
          resolvedWasmPath = distWasmPath;
        }
      }
    }

    if (!resolvedWasmPath) {
      const endTime = Date.now();
      return {
        result: null,
        error: `WASM file not found in function directory: ${functionDir}.`,
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    }

    return new Promise((resolve) => {
      const runnerProcess = spawn('shopify', [
        'app', 'function', 'runner',
        '--wasm-path', resolvedWasmPath,
        '--export', fixture.export,
        '--json',
      ], {
        cwd: appRootDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SHOPIFY_INVOKED_BY: 'shopify-function-test-helpers'
        }
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
        const endTime = Date.now();
        const timing = {
          startTime,
          endTime,
          durationMs: endTime - startTime
        };

        if (code !== 0) {
          resolve({
            result: null,
            error: `function-runner failed with exit code ${code}: ${stderr}`,
            timing
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);

          // function-runner output format: { output: {...} }
          resolve({
            result: { output: result.output || result },
            error: null,
            timing
          });
        } catch (parseError) {
          resolve({
            result: null,
            error: `Failed to parse function-runner output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            timing
          });
        }
      });

      runnerProcess.on('error', (error) => {
        const endTime = Date.now();
        resolve({
          result: null,
          error: `Failed to start function-runner: ${error.message}`,
          timing: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        });
      });

      runnerProcess.stdin.write(inputJson);
      runnerProcess.stdin.end();
    });

  } catch (error) {
    const endTime = Date.now();
    if (error instanceof Error) {
      return {
        result: null,
        error: error.message,
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    } else {
      return {
        result: null,
        error: 'Unknown error occurred',
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime
        }
      };
    }
  }
}




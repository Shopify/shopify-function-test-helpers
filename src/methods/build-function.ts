/**
 * Build a function run payload from a cart and options
 */

import path from "path";
import { fileURLToPath } from "url";

import { execa } from "execa";

/**
 * Interface for the build function result
 */
export interface BuildFunctionResult {
  success: boolean;
  output: string | null;
  error: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build a function run payload from a cart and options
 * @param {string} functionPath - Optional path to the function directory
 * @returns {Object} A function run payload
 */
export async function buildFunction(
  functionPath?: string,
): Promise<BuildFunctionResult> {
  let functionDir;
  let appRootDir;
  let functionName;

  if (functionPath) {
    // Use provided function path
    functionDir = path.resolve(functionPath);
    appRootDir = path.dirname(functionDir);
    functionName = path.basename(functionDir);
  } else {
    // Calculate paths correctly for when used as a dependency:
    // __dirname = /path/to/function/tests/node_modules/function-testing-helpers/src/methods
    // Go up 5 levels to get to function directory: ../../../../../ = /path/to/function
    functionDir = path.dirname(
      path.dirname(path.dirname(path.dirname(path.dirname(__dirname)))),
    );
    appRootDir = path.dirname(functionDir);
    functionName = path.basename(functionDir);
  }

  try {
    const result = await execa(
      "shopify",
      ["app", "function", "build", "--path", functionName],
      {
        cwd: appRootDir,
        env: {
          ...process.env,
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        },
      },
    );

    return {
      success: true,
      output: result.stdout.trim(),
      error: null,
    };
  } catch (error: any) {
    // Handle command execution errors (non-zero exit code)
    if (error?.exitCode !== undefined) {
      const stderr = error?.stderr || "";
      throw new Error(
        `Build command failed with exit code ${error.exitCode}${stderr ? `: ${stderr}` : ""}`,
      );
    }

    // Handle spawn/process errors (command not found, etc.)
    throw new Error(
      `Failed to start shopify build command: ${error?.message || String(error)}`,
    );
  }
}

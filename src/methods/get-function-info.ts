/**
 * Retrieve function information from the Shopify CLI
 */

import path from "path";

import { execa } from "execa";

/**
 * Information about a Shopify function
 */
export interface FunctionInfo {
  schemaPath: string;
  functionRunnerPath: string;
  wasmPath: string;
  targeting: Record<string, any>;
}

/**
 * A target as Shopify CLI 5 lists it in `app function info --json`
 */
interface FunctionInfoTarget {
  target: string;
  [key: string]: unknown;
}

/**
 * Shopify CLI 5 nests the info under `function` and lists the targets as an
 * array of `{ target, inputQueryPath, export }`. Earlier versions return the
 * info at the top level, with `targeting` keyed by target. Both come back in
 * the earlier shape, which `FunctionInfo` describes.
 */
function normalizeFunctionInfo(output: any): FunctionInfo {
  const info = output?.function ?? output;
  if (!info.targeting && Array.isArray(info.targets)) {
    info.targeting = Object.fromEntries(
      info.targets.map(({ target, ...rest }: FunctionInfoTarget) => [
        target,
        rest,
      ]),
    );
  }
  return info as FunctionInfo;
}

/**
 * Retrieves function information from the Shopify CLI
 * @param {string} functionDir - The directory path of the function
 * @returns {Promise<FunctionInfo>} Function information including schemaPath, functionRunnerPath, wasmPath, and targeting
 * @throws {Error} If the CLI command is not available or fails
 */
export async function getFunctionInfo(
  functionDir: string,
): Promise<FunctionInfo> {
  const resolvedFunctionDir = path.resolve(functionDir);
  const appRootDir = path.dirname(resolvedFunctionDir);
  const functionName = path.basename(resolvedFunctionDir);

  try {
    const result = await execa(
      "shopify",
      ["app", "function", "info", "--json", "--path", functionName],
      {
        cwd: appRootDir,
        env: {
          ...process.env,
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        },
      },
    );

    return normalizeFunctionInfo(JSON.parse(result.stdout.trim()));
  } catch (error: any) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse function info JSON: ${error.message}`);
    }

    // Check if the error is due to the command not being found
    const stderr = error?.stderr || "";
    if (
      stderr.includes("Command app function info not found") ||
      stderr.includes("command not found")
    ) {
      throw new Error(
        'The "shopify app function info" command is not available in your CLI version.\n' +
          "Please upgrade to the latest version:\n" +
          "  npm install -g @shopify/cli@latest\n\n",
      );
    }

    // Handle command execution errors
    if (error?.exitCode !== undefined) {
      throw new Error(
        `Function info command failed with exit code ${error.exitCode}: ${stderr}`,
      );
    }

    // Generic error fallback (spawn/process errors)
    throw new Error(
      `Failed to start shopify function info command: ${error?.message || String(error)}`,
    );
  }
}

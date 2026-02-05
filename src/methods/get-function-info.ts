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

    const functionInfo = JSON.parse(result.stdout.trim()) as FunctionInfo;
    return functionInfo;
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

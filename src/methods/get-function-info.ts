/**
 * Retrieve function information from the Shopify CLI
 */

import { spawn } from "child_process";
import path from "path";

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

  return new Promise((resolve, reject) => {
    const shopifyProcess = spawn(
      "shopify",
      ["app", "function", "info", "--json", "--path", functionName],
      {
        cwd: appRootDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        },
      },
    );

    let stdout = "";
    let stderr = "";

    shopifyProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    shopifyProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    shopifyProcess.on("close", (code) => {
      if (code !== 0) {
        // Check if the error is due to the command not being found
        if (
          stderr.includes("Command app function info not found") ||
          stderr.includes("command not found")
        ) {
          reject(
            new Error(
              'The "shopify app function info" command is not available in your CLI version.\n' +
                "Please upgrade to the latest version:\n" +
                "  npm install -g @shopify/cli@latest\n\n",
            ),
          );
          return;
        }
        reject(
          new Error(
            `Function info command failed with exit code ${code}: ${stderr}`,
          ),
        );
        return;
      }

      try {
        const functionInfo = JSON.parse(stdout.trim()) as FunctionInfo;
        resolve(functionInfo);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        reject(
          new Error(
            `Failed to parse function info JSON: ${errorMessage}\nOutput: ${stdout}`,
          ),
        );
      }
    });

    shopifyProcess.on("error", (error) => {
      reject(
        new Error(
          `Failed to start shopify function info command: ${error.message}`,
        ),
      );
    });
  });
}

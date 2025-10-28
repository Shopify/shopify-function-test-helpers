/**
 * Retrieve function information from the Shopify CLI
 */

import { execSync } from 'child_process';

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
 * @returns {FunctionInfo} Function information including schemaPath, functionRunnerPath, wasmPath, and targeting
 * @throws {Error} If the CLI command is not available or fails
 */
export function getFunctionInfo(functionDir: string): FunctionInfo {
  let functionInfoJson: string;

  try {
    functionInfoJson = execSync(
      `shopify app function info --json --path ${functionDir}`,
      {
        encoding: 'utf-8'
      }
    );
  } catch (error) {
    // Check if the error is due to the command not being found
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Command app function info not found')) {
      throw new Error(
        'The "shopify app function info" command is not available in your CLI version.\n' +
        'Please upgrade to the latest version:\n' +
        '  npm install -g @shopify/cli@latest\n\n'
      );
    }
    throw error;
  }

  return JSON.parse(functionInfoJson) as FunctionInfo;
}

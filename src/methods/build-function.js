/**
 * Build a function run payload from a cart and options
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Build a function run payload from a cart and options
 * @returns {Object} A function run payload
 */
function buildFunction() {
  try {
    // Calculate paths correctly:
    // __dirname = /path/to/function/tests/helpers
    // functionDir = /path/to/function (go up 2 levels from helpers)
    // appRootDir = /path/to (go up 1 more level to get to app root)
    const functionDir = path.dirname(path.dirname(__dirname));
    const appRootDir = path.dirname(functionDir);
    const functionName = path.basename(functionDir);

    return new Promise((resolve, reject) => {
      const shopifyProcess = spawn('shopify', [
        'app', 'function', 'build',
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
          reject(new Error(`Build command failed with exit code ${code}: ${stderr}`));
          return;
        }

        resolve({
          success: true,
          output: stdout.trim(),
          error: null,
        });
      });

      shopifyProcess.on('error', (error) => {
        reject(new Error(`Failed to start shopify build command: ${error.message}`));
      });
    });

  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        output: null,
        error: error.message,
      };
    } else {
      return {
        success: false,
        output: null,
        error: 'Unknown error occurred during build',
      };
    }
  }
}

module.exports = buildFunction;

/**
 * Build a function run payload from a cart and options
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Build a function run payload from a cart and options
 * @param {string} functionPath - Optional path to the function directory
 * @returns {Object} A function run payload
 */
async function buildFunction(functionPath) {
  try {
    let functionDir, appRootDir, functionName;
    
    if (functionPath) {
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

/**
 * Run a function with the given payload and return the result
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Run a function with the given payload and return the result
 * @param {String} exportName - The function run payload
 * @param {String} input - The actual function implementation to test
 * @returns {Object} The function run result
 */
async function runFunction(exportName, input) {
  try {
    const inputJson = JSON.stringify(input);

    // Calculate paths correctly for when used as a dependency:
    // __dirname = /path/to/function/tests/node_modules/function-testing-helpers/src/methods
    // Go up 5 levels to get to function directory: ../../../../../ = /path/to/function
    const functionDir = path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(__dirname)))));
    const appRootDir = path.dirname(functionDir);
    const functionName = path.basename(functionDir);
    
    console.log('functionName', functionName);
    console.log('appRootDir', appRootDir);
    console.log('functionDir', functionDir);

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
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
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
        reject(new Error(`Failed to start shopify command: ${error.message}`));
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

module.exports = runFunction;

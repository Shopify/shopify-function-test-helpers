/**
 * Load a fixture from the test_data directory
 */

const fs = require('fs');
const path = require('path');

/**
 * Load a fixture from the test_data directory
 * @param {string} filename - The name of the fixture file
 * @returns {Object} The parsed fixture data
 */
async function loadFixture(filename) {
  try {
    const fixtureContent = await fs.promises.readFile(filename, 'utf-8');
    const fixture = JSON.parse(fixtureContent);

    return {
      export: fixture.payload.export,
      input: fixture.payload.input,
      expectedOutput: fixture.payload.output,
      target: fixture.payload.target,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in fixture file ${fixturePath}: ${error.message}`);
    } else if (error instanceof Error) {
      throw new Error(`Failed to load fixture file ${fixturePath}: ${error.message}`);
    } else {
      throw new Error(`Unknown error loading fixture file ${fixturePath}`);
    }
  } 
}

module.exports = loadFixture;

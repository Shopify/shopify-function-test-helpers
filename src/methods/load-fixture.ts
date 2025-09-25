/**
 * Load and parse a fixture file
 */

import fs from 'fs';

/**
 * Interface for the parsed fixture data structure
 */
export interface FixtureData {
  export: Record<string, any>;
  input: Record<string, any>;
  expectedOutput: Record<string, any>;
  target: string;
}

/**
 * Load and parse a fixture file, extracting the payload data
 * @param {string} filename - The path to the fixture JSON file
 * @returns {Promise<Object>} The parsed fixture data with structure:
 *   - export: Object - The export data from payload.export
 *   - input: Object - The input data from payload.input
 *   - expectedOutput: Object - The output data from payload.output  
 *   - target: string - The target string from payload.target
 */
export async function loadFixture(filename: string): Promise<FixtureData> {
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
      throw new Error(`Invalid JSON in fixture file ${filename}: ${error.message}`);
    } else if (error instanceof Error) {
      throw new Error(`Failed to load fixture file ${filename}: ${error.message}`);
    } else {
      throw new Error(`Unknown error loading fixture file ${filename}`);
    }
  } 
}


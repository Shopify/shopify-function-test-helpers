const { validate, parse, buildSchema } = require('graphql');
const fs = require('fs').promises;

/**
 * Validate a fixture to ensure it has the correct structure
 */

/**
 * Validate a GraphQL input query file against a schema file
 * @param {string} queryPath - Path to the GraphQL query file
 * @param {string} schemaPath - Path to the GraphQL schema file
 * @returns {Promise<Array>} Promise resolving to array of validation errors
 */
async function validateInputQuery(queryPath, schemaPath) {
  try {
    const inputQueryString = await fs.readFile(queryPath, 'utf8');
    const inputQueryAST = parse(inputQueryString);
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);
    
    const validationErrors = validate(schema, inputQueryAST);
    return validationErrors;
  } catch (error) {
    return [{ message: `Failed to validate query: ${error.message}` }];
  }
}

module.exports = validateInputQuery;
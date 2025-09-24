const { validate, parse } = require('graphql');

/**
 * Validate a GraphQL input query string against a schema
 * @param {string} queryString - The GraphQL query string content
 * @param {GraphQLSchema} schema - Pre-built GraphQL schema
 * @returns {Array<Object>} Array of GraphQL validation errors (empty if valid).
 *   Each error has a 'message' property with the error description.
 */
function validateInputQuery(queryString, schema) {
  try {
    const inputQueryAST = parse(queryString);
    const validationErrors = validate(schema, inputQueryAST);
    return validationErrors;
  } catch (error) {
    return [{ message: `Failed to validate query: ${error.message}` }];
  }
}

module.exports = validateInputQuery;
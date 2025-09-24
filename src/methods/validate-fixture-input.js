const { graphql } = require('graphql');
const { convertFixtureToQuery } = require('../utils/convert-fixture-to-query');

/**
 * Validate input fixture data using the original schema with Query root
 * 
 * Since input fixture data represents the result of running an input query 
 * against the schema, we can validate it by generating a query from the fixture
 * structure and executing it against the original schema directly.
 * 
 * This approach is simpler than building reduced schemas because:
 * 1. The original schema already has a Query root type
 * 2. No need to convert input types to output types  
 * 3. Uses the full schema context for validation
 * 4. Leverages existing resolvers if any
 * 
 * @param {Object} inputFixtureData - The input fixture data to validate
 * @param {GraphQLSchema} originalSchema - The original GraphQL schema with Query root
 * @returns {Promise<Object>} Validation result with structure:
 *   - valid: boolean - Whether the fixture data is valid
 *   - errors: Array<string> - Array of error messages (empty if valid)
 *   - data: Object|null - The resulting data from query execution
 *   - query: string|null - The GraphQL query generated from fixture structure
 */

async function validateFixtureInput(inputFixtureData, originalSchema) {
  try {
    // Step 1: Convert fixture data structure to a GraphQL query
    // The query directly matches the Input type structure (no field wrapper needed)
    const query = convertFixtureToQuery(inputFixtureData, '');
    
    // Step 2: Execute the query against the original schema
    // The fixture data becomes the root value that resolvers will traverse
    const result = await graphql({
      schema: originalSchema,
      source: query,
      rootValue: inputFixtureData
    });

    if (result.errors && result.errors.length > 0) {
      return {
        valid: false,
        errors: result.errors.map(err => err.message),
        data: result.data || null,
        query
      };
    }

    // If we successfully executed the query and got data back,
    // it means the fixture structure matches what the schema expects
    return {
      valid: true,
      errors: [],
      data: result.data,
      query
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Input fixture validation failed: ${error.message}`],
      data: null,
      query: null
    };
  }
}

module.exports = {
  validateFixtureInput
};
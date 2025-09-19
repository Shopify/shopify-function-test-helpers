const { graphql } = require('graphql');
const buildReducedSchema = require('./build-reduced-schema');
const { convertFixtureToQuery } = require('./convert-fixture-to-query');
const { buildSchemaWithResolvers } = require('./build-schema-with-resolvers');




/**
 * Validate output fixture data using GraphQL execution with type conversion
 * 
 * This function is specifically designed for validating output fixture data against
 * GraphQL result types (like CartValidationsGenerateRunResult). It handles the
 * complexity of converting input types to output types and creating executable schemas.
 * 
 * @param {Object} outputFixtureData - The output fixture data to validate
 * @param {GraphQLSchema} originalSchema - The original GraphQL schema  
 * @param {string} targetTypeName - The target output type name (e.g., 'CartValidationsGenerateRunResult')
 * @returns {Promise<Object>} Validation result with validity and errors
 */
async function validateOutputFixture(outputFixtureData, originalSchema, targetTypeName) {
  try {
    // Step 1: Convert fixture to query
    const query = convertFixtureToQuery(outputFixtureData, 'data');
    
    // Step 2: Build reduced schema with resolvers for the output type
    const reducedSchema = buildReducedSchema(targetTypeName, originalSchema);
    const executableSchema = buildSchemaWithResolvers(targetTypeName, reducedSchema);
    
    // Step 3: Execute query with fixture data as root value
    // GraphQL will automatically validate types during execution
    const result = await graphql({
      schema: executableSchema,
      source: query,
      rootValue: { data: outputFixtureData }
    });

    if (result.errors && result.errors.length > 0) {
      return {
        valid: false,
        errors: result.errors.map(err => err.message),
        data: result.data || null,
        query
      };
    }

    return {
      valid: true,
      errors: [],
      data: result.data,
      query
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Output fixture validation failed: ${error.message}`],
      data: null,
      query: null
    };
  }
}

module.exports = {
  validateOutputFixture
};
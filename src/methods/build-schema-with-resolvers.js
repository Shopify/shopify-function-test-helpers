const { GraphQLSchema, GraphQLObjectType, isInputType } = require('graphql');
const { convertInputTypeToOutputType } = require('./convert-input-type-to-output-type');

/**
 * Build an executable schema with resolvers from a reduced schema
 * 
 * This function creates a Query root type that can execute GraphQL queries
 * against fixture data for validation purposes. It handles:
 * 1. Converting input types to output types if necessary
 * 2. Creating a Query root with a 'data' field
 * 3. Setting up resolvers that return fixture data
 * 4. Including all existing types from the reduced schema
 * 
 * @param {string} targetTypeName - The target type name to create a query field for
 * @param {GraphQLSchema} reducedSchema - The reduced schema containing target types
 * @returns {GraphQLSchema} Executable schema with Query root type
 */
function buildSchemaWithResolvers(targetTypeName, reducedSchema) {
  const targetType = reducedSchema.getType(targetTypeName);
  if (!targetType) {
    throw new Error(`Target type '${targetTypeName}' not found in reduced schema`);
  }

  // Convert input type to output type if necessary
  const outputType = isInputType(targetType) 
    ? convertInputTypeToOutputType(targetType)
    : targetType;

  // Create a Query root type that has a field returning our target type
  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      data: {
        type: outputType,
        resolve: (root) => root.data // Return the data from root value
      }
    }
  });

  // Get all existing types from the reduced schema
  const existingTypes = Object.values(reducedSchema.getTypeMap())
    .filter(type => !type.name.startsWith('__'));

  // Create new schema with Query root and all existing types
  return new GraphQLSchema({
    query: QueryType,
    types: existingTypes
  });
}

module.exports = {
  buildSchemaWithResolvers
};
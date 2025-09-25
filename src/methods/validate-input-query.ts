import { validate, parse, GraphQLSchema, GraphQLError } from 'graphql';

/**
 * Validate a GraphQL input query string against a schema
 * @param {string} queryString - The GraphQL query string content
 * @param {GraphQLSchema} schema - Pre-built GraphQL schema
 * @returns {Array<Object>} Array of GraphQL validation errors (empty if valid).
 *   Each error has a 'message' property with the error description.
 */
export function validateInputQuery(queryString: string, schema: GraphQLSchema): GraphQLError[] {
  try {
    const inputQueryAST = parse(queryString);
    const validationErrors = validate(schema, inputQueryAST);
    return [...validationErrors];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return [new GraphQLError(`Failed to validate query: ${errorMessage}`)];
  }
}


import { validate, GraphQLSchema, GraphQLError, DocumentNode } from 'graphql';

/**
 * Validate a GraphQL input query AST against a schema
 * @param {DocumentNode} queryAST - The GraphQL query AST
 * @param {GraphQLSchema} schema - Pre-built GraphQL schema
 * @returns {readonly GraphQLError[]} Array of GraphQL validation errors (empty if valid).
 *   Each error has a 'message' property with the error description.
 */
export function validateInputQuery(queryAST: DocumentNode, schema: GraphQLSchema): readonly GraphQLError[] {
  try {
    return validate(schema, queryAST);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return [new GraphQLError(`Failed to validate query: ${errorMessage}`)];
  }
}


/**
 * Load and build a GraphQL schema from a schema file path
 */

import fs from 'fs';
import { buildSchema as graphqlBuildSchema } from 'graphql';

/**
 * Load and build a GraphQL schema object from a schema file path
 * @param {string} schemaPath - The path to the GraphQL schema file
 * @returns {Promise<GraphQLSchema>} The built GraphQL schema object
 */
export async function loadSchema(schemaPath) {
  try {
    const schemaString = await fs.promises.readFile(schemaPath, 'utf8');
    return graphqlBuildSchema(schemaString);
  } catch (error) {
    throw new Error(`Failed to build schema from ${schemaPath}: ${error.message}`);
  }
}
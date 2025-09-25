import fs from 'fs';
import { parse, DocumentNode } from 'graphql';

/**
 * Load and parse a GraphQL query from a file path
 * 
 * Reads a GraphQL query file and parses it into a DocumentNode AST.
 * This is useful for loading input queries for validation and testing.
 * 
 * @param {string} queryPath - Path to the GraphQL query file
 * @returns {Promise<DocumentNode>} The parsed GraphQL document AST
 * @throws {Error} If the file cannot be read or the query cannot be parsed
 */
export async function loadInputQuery(queryPath: string): Promise<DocumentNode> {
  try {
    const queryString = await fs.promises.readFile(queryPath, 'utf8');
    return parse(queryString);
  } catch (error) {
    throw new Error(`Failed to load input query from ${queryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
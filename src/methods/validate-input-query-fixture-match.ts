import { parse, validate, GraphQLSchema, GraphQLError, DocumentNode, print } from 'graphql';
import { convertFixtureToQuery } from '../utils/convert-fixture-to-query.js';

/**
 * Interface for query-fixture match validation result
 */
export interface QueryFixtureMatchResult {
  valid: boolean;
  errors: string[];
  inputQuery: string;
  fixtureQuery: string;
}

/**
 * Validates that an input query's selection set matches the shape of fixture input data
 * 
 * This approach generates a query from the fixture structure using convertFixtureToQuery,
 * then compares the selection sets of both queries using AST comparison.
 * 
 * This ensures that the fixture data is realistic for the given query - the fixture
 * should contain data for all fields selected in the query, and ideally shouldn't
 * contain extra fields that the query doesn't select.
 * 
 * @param {string} inputQueryString - The GraphQL query string
 * @param {Object} fixtureInputData - The input fixture data
 * @param {GraphQLSchema} schema - The GraphQL schema for query validation
 * @returns {Promise<QueryFixtureMatchResult>} Validation result indicating whether query and fixture match
 */
export async function validateQueryFixtureMatch(
  inputQueryString: string,
  fixtureInputData: Record<string, any>,
  schema: GraphQLSchema
): Promise<QueryFixtureMatchResult> {
  const result: QueryFixtureMatchResult = {
    valid: false,
    errors: [],
    inputQuery: inputQueryString,
    fixtureQuery: ''
  };

  try {
    // Step 1: Validate the input query
    const inputDocument = parse(inputQueryString);
    const validationErrors = validate(schema, inputDocument);
    
    if (validationErrors.length > 0) {
      result.errors.push(`Input query validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
      return result;
    }

    // Step 2: Generate a query from the fixture structure
    result.fixtureQuery = convertFixtureToQuery(fixtureInputData, '');
    
    // Step 3: Parse and validate the fixture-generated query
    const fixtureDocument = parse(result.fixtureQuery);
    const fixtureValidationErrors = validate(schema, fixtureDocument);
    
    if (fixtureValidationErrors.length > 0) {
      result.errors.push(`Fixture-generated query validation failed: ${fixtureValidationErrors.map(e => e.message).join(', ')}`);
      return result;
    }

    // Step 4: Compare queries using canonical print format
    // GraphQL's print() function produces a canonical representation
    const canonicalInput = removeQueryName(print(inputDocument));
    const canonicalFixture = removeQueryName(print(fixtureDocument));
    
    if (canonicalInput === canonicalFixture) {
      result.valid = true;
    } else {
      result.valid = false;
      result.errors.push('Query structure does not match fixture data structure');
    }
    
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Query-fixture match validation failed: ${errorMessage}`);
    return result;
  }
}

/**
 * Remove query names from GraphQL strings for comparison
 * 
 * GraphQL's print() function:
 * - Named queries: "query SomeName { ... }" prints as "query SomeName { ... }"  
 * - Anonymous queries: "query { ... }" prints as "{ ... }" (drops query keyword)
 * - convertFixtureToQuery generates anonymous queries that print as "{ ... }"
 * 
 * We only need to remove query names - anonymous queries are already in the right format!
 */
function removeQueryName(graphqlString: string): string {
  return graphqlString
    .replace(/^query\s+\w+\s*/, '');  // Remove named queries: "query SomeName {...}" → "{...}"
}
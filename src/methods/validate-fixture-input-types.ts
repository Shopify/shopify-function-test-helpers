import {
  graphql,
  GraphQLSchema,
  GraphQLFieldResolver,
  defaultFieldResolver,
} from "graphql";

/**
 * Interface for validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data: any;
  query: string;
}

/**
 * Validate input fixture data types using the original schema with Query root
 *
 * This function validates that the fixture data types match the GraphQL schema's type system
 * by executing the provided query against the schema with a custom resolver that handles aliases.
 *
 * The query and fixture data should be from validateFixtureInputStructure.
 *
 * @param {string} query - The GraphQL query string (from validateFixtureInputStructure)
 * @param {GraphQLSchema} schema - The GraphQL schema to validate against
 * @param {Record<string, any>} fixtureData - The fixture data with aliases preserved (from validateFixtureInputStructure)
 * @returns {Promise<ValidationResult>} Validation result with structure:
 *   - valid: boolean - Whether the fixture data types are valid against the schema
 *   - errors: string[] - Array of error messages (empty if valid)
 *   - data: Object|null - The resulting data from query execution
 *   - query: string - The query that was executed
 */
export async function validateFixtureInputTypes(
  query: string,
  schema: GraphQLSchema,
  fixtureData: Record<string, any>
): Promise<ValidationResult> {
  const result = await graphql({
    schema,
    source: query,
    rootValue: fixtureData,
    fieldResolver: createAliasAwareResolver(fixtureData),
  });

  return {
    valid: !result.errors || result.errors.length === 0,
    errors: result.errors?.map((err) => err.message) || [],
    data: result.data || null,
    query,
  };
}

/**
 * Create a custom field resolver that handles aliases
 * This resolver first looks for the aliased field name, then falls back to the actual field name
 */
function createAliasAwareResolver(
  originalFixtureData: Record<string, any>
): GraphQLFieldResolver<any, any> {
  return (source, args, context, info) => {
    // info.path contains the current path in the query execution
    // We need to find the corresponding data in the original fixture

    // Build the path to look up in original fixture
    const pathParts: (string | number)[] = [];
    let currentPath: typeof info.path | undefined = info.path;
    while (currentPath) {
      pathParts.unshift(currentPath.key);
      currentPath = currentPath.prev;
    }

    // Navigate to the parent object in original fixture
    let currentData: any = originalFixtureData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const key = pathParts[i];
      if (currentData && typeof currentData === "object") {
        currentData = currentData[key];
      } else {
        break;
      }
    }

    // Try to get the value using the alias from the original fixture
    const fieldName = info.fieldName;
    const alias = info.fieldNodes[0]?.alias?.value;

    if (currentData && typeof currentData === "object") {
      // Try alias first (for cases where fixture uses alias keys)
      if (alias && alias in currentData) {
        return currentData[alias];
      }
      // Fall back to actual field name
      if (fieldName in currentData) {
        return currentData[fieldName];
      }
    }

    // Fall back to default resolver
    return defaultFieldResolver(source, args, context, info);
  };
}

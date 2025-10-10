import {
  graphql,
  GraphQLSchema,
  GraphQLFieldResolver,
  GraphQLTypeResolver,
  defaultFieldResolver,
  responsePathAsArray,
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
 * @param {Record<string, any>} fixtureInputData - The fixture input data with aliases preserved (from validateFixtureInputStructure)
 * @param {Record<string, any>} fixtureInputQueryVariables - Optional input query variable values from the fixture
 * @returns {Promise<ValidationResult>} Validation result with structure:
 *   - valid: boolean - Whether the fixture data types are valid against the schema
 *   - errors: string[] - Array of error messages (empty if valid)
 *   - data: Object|null - The resulting data from query execution
 *   - query: string - The query that was executed
 */
export async function validateFixtureInputTypes(
  query: string,
  schema: GraphQLSchema,
  fixtureInputData: Record<string, any>,
  fixtureInputQueryVariables?: Record<string, any>
): Promise<ValidationResult> {

  const result = await graphql({
    schema,
    source: query,
    rootValue: fixtureInputData,
    variableValues: fixtureInputQueryVariables,
    fieldResolver: createFieldResolver(fixtureInputData),
    typeResolver: createTypeResolver(schema),
  });

  return {
    valid: !result.errors,
    errors: result.errors?.map((err) => err.message) || [],
    data: result.data || null,
    query,
  };
}

/**
 * Navigate to the parent object in nested data using a path array
 * Stops one level before the last key to return the parent object
 * @param data - The root data object
 * @param pathParts - Array of keys to traverse
 * @returns The parent object, or undefined if not found
 */
function navigateToParent(
  data: any,
  pathParts: (string | number)[]
): any {
  let currentData = data;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (currentData && typeof currentData === "object") {
      currentData = currentData[key];
    } else {
      return undefined;
    }
  }

  return currentData;
}

/**
 * Create a custom field resolver that handles aliases
 * This resolver first looks for the aliased field name, then falls back to the actual field name
 */
function createFieldResolver(
  originalFixtureInputData: Record<string, any>
): GraphQLFieldResolver<any, any> {
  return (source, args, context, info) => {
    // Build the path to look up in original fixture
    const pathParts = responsePathAsArray(info.path);

    // Navigate to the parent object in original fixture
    const currentData = navigateToParent(originalFixtureInputData, pathParts);

    // Try to get the value using the alias from the original fixture
    const fieldName = info.fieldName;
    // fieldNodes is an array because the same field can appear multiple times via fragments
    // All instances must have the same alias (or no alias), so we can use the first node
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

/**
 * Create a custom type resolver that infers the concrete type from fixture data
 * This handles union and interface types by checking which possible type's fields match the data
 */
function createTypeResolver(schema: GraphQLSchema): GraphQLTypeResolver<any, any> {
  return (value, _context, _info, abstractType) => {
    // If the value already has __typename, use it
    if (value && typeof value === 'object' && '__typename' in value) {
      return value.__typename as string;
    }

    // Get possible types for this abstract type
    const possibleTypes = schema.getPossibleTypes(abstractType);

    // Get the fields present in the value
    const valueKeys = value && typeof value === 'object' ? Object.keys(value) : [];

    // Find the type that best matches the fields in the value
    for (const possibleType of possibleTypes) {
      const typeFields = possibleType.getFields();
      const typeFieldNames = Object.keys(typeFields);

      // Check if all value keys are valid fields for this type
      if (valueKeys.every(key => typeFieldNames.includes(key)) && valueKeys.length > 0) {
        return possibleType.name;
      }
    }

    // If no match found, return undefined and let GraphQL report the error
    return undefined;
  };
}

import { isNonNullType, coerceInputValue, isInputType, GraphQLSchema } from 'graphql';

/**
 * Interface for output fixture validation result
 */
export interface OutputValidationResult {
  valid: boolean;
  errors: Array<{ message: string }>;
  mutationName: string;
  resultParameterType: string | null;
}

/**
 * Validate output fixture by checking if it can be used as input to the corresponding mutation
 * 
 * This approach leverages the fact that function output fixtures are designed to be used
 * as input parameters to GraphQL mutations. We can validate them by:
 * 1. Finding the mutation field and its parameter type in the schema
 * 2. Using GraphQL's coerceInputValue() to validate the fixture data against the expected input type
 * 
 * @param {Object} outputFixtureData - The output fixture data to validate
 * @param {GraphQLSchema} originalSchema - The original GraphQL schema
 * @param {string} mutationName - The mutation field name (e.g., 'cartValidationsGenerateRun')
 * @param {string} resultParameterName - The parameter name in the mutation (usually 'result')
 * @returns {Object} Validation result with structure:
 *   - valid: boolean - Whether the fixture data is valid for the mutation
 *   - errors: Array<Object> - Array of GraphQL coercion errors (empty if valid)
 *   - mutationName: string - The mutation name that was validated
 *   - resultParameterType: string|null - The GraphQL type of the result parameter
 */
export async function validateFixtureOutput(
  outputFixtureData: Record<string, any>,
  originalSchema: GraphQLSchema,
  mutationName: string,
  resultParameterName: string = 'result'
): Promise<OutputValidationResult> {
  try {
    // Get the mutation type from schema
    const mutationType = originalSchema.getMutationType();
    if (!mutationType) {
      throw new Error('Schema does not have a mutation type');
    }

    // Get the specific mutation field
    const mutationFields = mutationType.getFields();
    const mutationField = mutationFields[mutationName];
    if (!mutationField) {
      throw new Error(`Mutation '${mutationName}' not found in schema`);
    }

    // Get the result parameter type
    const resultArg = mutationField.args.find(arg => arg.name === resultParameterName);
    if (!resultArg) {
      throw new Error(`Parameter '${resultParameterName}' not found in mutation '${mutationName}'`);
    }

    // Validate the fixture data directly against the parameter type
    let errors: Array<{ message: string }> = [];
    try {
      // Validate the result parameter value against its expected type
      let inputType = resultArg.type;
      
      // Handle NonNull wrapper types
      if (isNonNullType(inputType)) {
        inputType = inputType.ofType;
      }
      
      if (isInputType(inputType)) {
        const coercionResult = coerceInputValue(outputFixtureData, resultArg.type);
        if (coercionResult && typeof coercionResult === 'object' && 'errors' in coercionResult && Array.isArray(coercionResult.errors) && coercionResult.errors.length > 0) {
          errors.push(...coercionResult.errors.map((err: any) => ({ message: err.message || String(err) })));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors = [{ message: errorMessage }];
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      mutationName: mutationName,
      resultParameterType: resultArg.type.toString()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      errors: [{ message: errorMessage }],
      mutationName: mutationName,
      resultParameterType: null
    };
  }
}


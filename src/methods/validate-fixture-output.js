const { validate, parse, graphql, isScalarType, isNonNullType, coerceInputValue, isInputType } = require('graphql');

/**
 * Validate output fixture by checking if it can be used as input to the corresponding mutation
 * 
 * This approach leverages the fact that function output fixtures are designed to be used
 * as input parameters to GraphQL mutations. We can validate them by:
 * 1. Creating a mutation query using the fixture data as variables
 * 2. Using GraphQL's native validate() function to check type compliance
 * 
 * @param {Object} outputFixtureData - The output fixture data to validate
 * @param {GraphQLSchema} originalSchema - The original GraphQL schema
 * @param {string} mutationName - The mutation field name (e.g., 'cartValidationsGenerateRun')
 * @param {string} resultParameterName - The parameter name in the mutation (usually 'result')
 * @returns {Object} Validation result with { valid, errors, query, variables }
 */
async function validateFixtureOutput(outputFixtureData, originalSchema, mutationName, resultParameterName = 'result') {
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

    // Check if the return type is a scalar (which doesn't need selection set)
    const returnType = mutationField.type;
    const actualType = isNonNullType(returnType) ? returnType.ofType : returnType;
    const isScalar = isScalarType(actualType) || actualType.name === 'Void';
    
    // Create a mutation query with variables
    const mutationQuery = `
      mutation TestOutputFixture($${resultParameterName}: ${resultArg.type.toString()}) {
        ${mutationName}(${resultParameterName}: $${resultParameterName})${isScalar ? '' : ' { __typename }'}
      }
    `;

    // Parse the query
    const documentAST = parse(mutationQuery);

    // Validate the query against the schema
    const validationErrors = validate(originalSchema, documentAST);

    // Create variables object
    const variables = {
      [resultParameterName]: outputFixtureData
    };

    // If query validation passes, validate the variable values against the input type
    let variableErrors = [];
    if (validationErrors.length === 0) {
      try {
        
        // Validate the result parameter value against its expected type
        let inputType = resultArg.type;
        
        // Handle NonNull wrapper types
        if (isNonNullType(inputType)) {
          inputType = inputType.ofType;
        }
        
        if (isInputType(inputType)) {
          const coercionResult = coerceInputValue(variables[resultParameterName], resultArg.type);
          if (coercionResult.errors && coercionResult.errors.length > 0) {
            variableErrors.push(...coercionResult.errors);
          }
        }
      } catch (error) {
        variableErrors = [{ message: error.message }];
      }
    }

    const allErrors = [...validationErrors, ...variableErrors];

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      query: mutationQuery,
      variables: variables,
      mutationName: mutationName,
      resultParameterType: resultArg.type.toString(),
      executionResult: variableErrors.length === 0 && validationErrors.length === 0
    };

  } catch (error) {
    return {
      valid: false,
      errors: [{ message: error.message }],
      query: null,
      variables: null,
      mutationName: mutationName,
      resultParameterType: null
    };
  }
}

module.exports = {
  validateFixtureOutput
};
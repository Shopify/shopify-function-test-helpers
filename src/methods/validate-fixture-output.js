const { validate, parse, graphql } = require('graphql');

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

    // Check if the return type is Void (which doesn't need selection set)
    const returnType = mutationField.type;
    const isVoidType = returnType.name === 'Void' || returnType.toString() === 'Void!';
    
    // Create a mutation query with variables
    const mutationQuery = `
      mutation TestOutputFixture($${resultParameterName}: ${resultArg.type.toString()}) {
        ${mutationName}(${resultParameterName}: $${resultParameterName})${isVoidType ? '' : ' { __typename }'}
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

    // If query validation passes, also validate the variable values by executing
    let executionErrors = [];
    if (validationErrors.length === 0) {
      try {
        const executionResult = await graphql({
          schema: originalSchema,
          source: mutationQuery,
          variableValues: variables
        });

        if (executionResult.errors) {
          executionErrors = executionResult.errors;
        }
      } catch (error) {
        executionErrors = [{ message: error.message }];
      }
    }

    const allErrors = [...validationErrors, ...executionErrors];

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      query: mutationQuery,
      variables: variables,
      mutationName: mutationName,
      resultParameterType: resultArg.type.toString(),
      executionResult: executionErrors.length === 0 && validationErrors.length === 0
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
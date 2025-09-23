const validateInputQuery = require('./validate-input-query');
const { validateFixtureInput } = require('./validate-fixture-input');
const { validateFixtureOutput } = require('./validate-fixture-output');
const { determineMutationFromTarget } = require('./determine-mutation-from-target');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

/**
 * Complete fixture validation - validates input query, input fixture, and output fixture
 * 
 * This function provides a one-stop validation solution that:
 * 1. Loads schema and fixture files from paths
 * 2. Validates the input query against the schema
 * 3. Validates the input fixture data against the schema
 * 4. Validates the output fixture data against the specified mutation
 * 
 * @param {Object} options - Validation options
 * @param {string} options.schemaPath - Path to the GraphQL schema file
 * @param {string} options.fixturePath - Path to the fixture JSON file
 * @param {string} options.inputQueryPath - Path to the input query file (required)
 * @param {string} [options.mutationName] - The mutation name for output validation (auto-determined from target if not provided)
 * @param {string} [options.resultParameterName] - The mutation parameter name (auto-determined from target if not provided)
 * @returns {Promise<Object>} Complete validation results
 */
async function validateFixture({
  schemaPath,
  fixturePath,
  inputQueryPath,
  mutationName,
  resultParameterName
}) {
  const results = {
    schemaPath,
    fixturePath,
    inputQueryPath,
    mutationName,
    resultParameterName,
    inputQuery: { valid: null, errors: [] },
    inputFixture: { valid: null, errors: [], data: null },
    outputFixture: { valid: null, errors: [], query: null, variables: null }
  };

  try {
    // Step 1: Load schema
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);

    // Step 2: Load fixture
    const fixtureContent = await fs.readFile(fixturePath, 'utf8');
    const fixture = JSON.parse(fixtureContent);

    // Step 3: Determine mutation details if not provided
    let finalMutationName = mutationName;
    let finalResultParameterName = resultParameterName;
    
    if (!finalMutationName || !finalResultParameterName) {
      const target = fixture.payload?.target;
      if (!target) {
        throw new Error('Fixture must contain payload.target when mutationName and resultParameterName are not provided');
      }
      
      const determined = determineMutationFromTarget(target, schema);
      finalMutationName = finalMutationName || determined.mutationName;
      finalResultParameterName = finalResultParameterName || determined.resultParameterName;
    }

    // Update results with final mutation details
    results.mutationName = finalMutationName;
    results.resultParameterName = finalResultParameterName;

    // Step 4: Validate input query
    const inputQueryString = await fs.readFile(inputQueryPath, 'utf8');
    const inputQueryErrors = validateInputQuery(inputQueryString, schema);
    results.inputQuery = {
      valid: inputQueryErrors.length === 0,
      errors: inputQueryErrors
    };

    // Step 5: Validate input fixture
    const inputFixtureResult = await validateFixtureInput(fixture.payload.input, schema);
    results.inputFixture = {
      valid: inputFixtureResult.valid,
      errors: inputFixtureResult.errors,
      data: inputFixtureResult.data
    };

    // Step 6: Validate output fixture
    const outputFixtureResult = await validateFixtureOutput(
      fixture.payload.output, 
      schema, 
      finalMutationName, 
      finalResultParameterName
    );
    results.outputFixture = {
      valid: outputFixtureResult.valid,
      errors: outputFixtureResult.errors,
      query: outputFixtureResult.query,
      variables: outputFixtureResult.variables
    };

    return results;

  } catch (error) {
    // Handle file loading or parsing errors
    return {
      ...results,
      error: error.message
    };
  }
}


module.exports = {
  validateFixture
};
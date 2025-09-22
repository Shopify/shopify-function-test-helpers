const validateInputQuery = require('./validate-input-query');
const { validateFixtureInput } = require('./validate-fixture-input');
const { validateFixtureOutput } = require('./validate-fixture-output');
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
 * @param {string} options.mutationName - The mutation name for output validation (e.g., 'cartLinesDiscountsGenerateRun')
 * @param {string} options.resultParameterName - The mutation parameter name (default: 'result')
 * @returns {Promise<Object>} Complete validation results
 */
async function validateFixtureComplete({
  schemaPath,
  fixturePath,
  inputQueryPath,
  mutationName,
  resultParameterName = 'result'
}) {
  const results = {
    schemaPath,
    fixturePath,
    inputQueryPath,
    mutationName,
    resultParameterName,
    inputQuery: { valid: null, errors: [] },
    inputFixture: { valid: null, errors: [], data: null },
    outputFixture: { valid: null, errors: [], query: null, variables: null },
    overall: { valid: null, summary: '' }
  };

  try {
    // Step 1: Load schema
    console.log(`Loading schema from: ${schemaPath}`);
    const schemaString = await fs.readFile(schemaPath, 'utf8');
    const schema = buildSchema(schemaString);

    // Step 2: Load fixture
    console.log(`Loading fixture from: ${fixturePath}`);
    const fixtureContent = await fs.readFile(fixturePath, 'utf8');
    const fixture = JSON.parse(fixtureContent);

    // Step 3: Validate input query
    console.log(`Validating input query from: ${inputQueryPath}`);
    const inputQueryString = await fs.readFile(inputQueryPath, 'utf8');
    const inputQueryErrors = validateInputQuery(inputQueryString, schema);
    results.inputQuery = {
      valid: inputQueryErrors.length === 0,
      errors: inputQueryErrors
    };

    // Step 4: Validate input fixture
    console.log('Validating input fixture data...');
    const inputFixtureResult = await validateFixtureInput(fixture.payload.input, schema);
    results.inputFixture = {
      valid: inputFixtureResult.valid,
      errors: inputFixtureResult.errors,
      data: inputFixtureResult.data
    };

    // Step 5: Validate output fixture
    console.log(`Validating output fixture against mutation: ${mutationName}`);
    const outputFixtureResult = await validateFixtureOutput(
      fixture.payload.output, 
      schema, 
      mutationName, 
      resultParameterName
    );
    results.outputFixture = {
      valid: outputFixtureResult.valid,
      errors: outputFixtureResult.errors,
      query: outputFixtureResult.query,
      variables: outputFixtureResult.variables
    };

    // Step 6: Determine overall validity
    const overallValid = results.inputQuery.valid && results.inputFixture.valid && results.outputFixture.valid;
    
    results.overall = {
      valid: overallValid,
      summary: generateSummary(results)
    };

    return results;

  } catch (error) {
    // Handle file loading or parsing errors
    results.overall = {
      valid: false,
      summary: `Validation failed: ${error.message}`
    };
    
    // Add the error to the appropriate section based on the error type
    if (error.message.includes('schema')) {
      results.inputQuery.errors.push(`Schema loading error: ${error.message}`);
      results.inputFixture.errors.push(`Schema loading error: ${error.message}`);
      results.outputFixture.errors.push(`Schema loading error: ${error.message}`);
    } else if (error.message.includes('fixture')) {
      results.inputFixture.errors.push(`Fixture loading error: ${error.message}`);
      results.outputFixture.errors.push(`Fixture loading error: ${error.message}`);
    } else {
      results.inputQuery.errors.push(error.message);
    }

    return results;
  }
}

/**
 * Generate a human-readable summary of validation results
 * @param {Object} results - The validation results object
 * @returns {string} Summary string
 */
function generateSummary(results) {
  const steps = [];
  
  steps.push(`Input Query: ${results.inputQuery.valid ? '✅ VALID' : '❌ INVALID'}`);
  steps.push(`Input Fixture: ${results.inputFixture.valid ? '✅ VALID' : '❌ INVALID'}`);
  steps.push(`Output Fixture: ${results.outputFixture.valid ? '✅ VALID' : '❌ INVALID'}`);
  
  const overallStatus = results.overall.valid ? '✅ ALL VALIDATIONS PASSED' : '❌ VALIDATION FAILED';
  
  return `${steps.join(' | ')} | Overall: ${overallStatus}`;
}

module.exports = {
  validateFixtureComplete
};
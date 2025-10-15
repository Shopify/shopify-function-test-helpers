import { validateInputQuery } from './validate-input-query.js';
import { validateFixtureInputTypes } from './validate-fixture-input-types.js';
import { validateFixtureOutput } from './validate-fixture-output.js';
import { validateFixtureInputStructure } from './validate-fixture-input-structure.js';
import { determineMutationFromTarget } from '../utils/determine-mutation-from-target.js';
import { GraphQLSchema, GraphQLError, DocumentNode, print } from 'graphql';
import { FixtureData } from './load-fixture.js';

/**
 * Interface for validate test assets options
 */
export interface ValidateTestAssetsOptions {
  schema: GraphQLSchema;
  fixture: FixtureData;
  inputQueryAST: DocumentNode;
  mutationName?: string;
  resultParameterName?: string;
}

/**
 * Interface for complete validation results
 */
export interface CompleteValidationResult {
  mutationName?: string;
  resultParameterName?: string;
  inputQuery: {
    valid: boolean;
    errors: readonly GraphQLError[];
  };
  fixtureInputStructure: {
    valid: boolean;
    errors: string[];
    generatedQuery?: string;
  };
  fixtureInputTypes: {
    valid: boolean;
    errors: string[];
    data: any;
  };
  fixtureOutput: {
    valid: boolean;
    errors: { message: string }[];
    mutationName: string | null;
    resultParameterType: string | null;
  };
  error?: string;
}

/**
 * Validates test assets (input query and fixture) before function execution
 *
 * This function provides a one-stop validation solution that:
 * 1. Validates the input query against the schema
 * 2. Validates the input fixture data against the schema
 * 3. Validates that the query structure matches the fixture data structure
 * 4. Validates the output fixture data against the specified mutation
 *
 * @param {Object} options - Validation options
 * @param {GraphQLSchema} options.schema - The built GraphQL schema
 * @param {Object} options.fixture - The loaded fixture data (from loadFixture)
 * @param {DocumentNode} options.inputQueryAST - The parsed input query AST (from loadInputQuery)
 * @param {string} [options.mutationName] - The mutation name for output validation (auto-determined from target if not provided)
 * @param {string} [options.resultParameterName] - The mutation parameter name (auto-determined from target if not provided)
 * @returns {Promise<Object>} Complete validation results with structure:
 *   - mutationName: string - Mutation name used for validation
 *   - resultParameterName: string - Parameter name used for validation
 *   - inputQuery: { valid: boolean, errors: Array } - Input query validation results
 *   - fixtureInputStructure: { valid: boolean, errors: Array, generatedQuery: string } - Fixture input structure validation results
 *   - fixtureInputTypes: { valid: boolean, errors: Array, data: Object } - Fixture input type validation results
 *   - fixtureOutput: { valid: boolean, errors: Array, mutationName: string, resultParameterType: string } - Fixture output validation results
 */
export async function validateTestAssets({
  schema,
  fixture,
  inputQueryAST,
  mutationName,
  resultParameterName
}: ValidateTestAssetsOptions): Promise<CompleteValidationResult> {
  const results: CompleteValidationResult = {
    mutationName,
    resultParameterName,
    inputQuery: { valid: false, errors: [] },
    fixtureInputStructure: { valid: false, errors: [] },
    fixtureInputTypes: { valid: false, errors: [], data: null },
    fixtureOutput: { valid: false, errors: [], mutationName: null, resultParameterType: null }
  };

  try {
    // Step 1: Validate input query
    const inputQueryErrors = validateInputQuery(inputQueryAST, schema);
    results.inputQuery = {
      valid: inputQueryErrors.length === 0,
      errors: inputQueryErrors
    };

    // Step 2: Validate fixture input structure
    const structureResult = validateFixtureInputStructure(inputQueryAST, schema, fixture.input);

    results.fixtureInputStructure = {
      valid: structureResult.valid,
      errors: structureResult.errors,
      generatedQuery: structureResult.generatedQuery
    };

    // Step 3: Validate fixture input types using generated query from structure validation
    // Pass variable values from fixture if present
    const typesResult = await validateFixtureInputTypes(
      structureResult.generatedQuery,
      schema,
      fixture.input,
      fixture.inputQueryVariables
    );
    results.fixtureInputTypes = {
      valid: typesResult.valid,
      errors: typesResult.errors,
      data: typesResult.data
    };

    // Step 4: Determine mutation details for output validation
    let determined;
    if (!mutationName || !resultParameterName) {
      const target = fixture.target;
      if (!target) {
        throw new Error('Fixture must contain target when mutationName and resultParameterName are not provided');
      }
      
      determined = determineMutationFromTarget(target, schema);
    }

    results.mutationName = mutationName || determined?.mutationName;
    results.resultParameterName = resultParameterName || determined?.resultParameterName;

    // Step 5: Validate fixture output
    if (!results.mutationName || !results.resultParameterName) {
      throw new Error('Unable to determine mutation name or result parameter name for output fixture validation');
    }

    const fixtureOutputResult = await validateFixtureOutput(
      fixture.expectedOutput,
      schema,
      results.mutationName,
      results.resultParameterName
    );
    results.fixtureOutput = {
      valid: fixtureOutputResult.valid,
      errors: fixtureOutputResult.errors,
      mutationName: fixtureOutputResult.mutationName,
      resultParameterType: fixtureOutputResult.resultParameterType
    };

    return results;

  } catch (error) {
    // Handle file loading or parsing errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ...results,
      error: errorMessage
    };
  }
}



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
  inputFixture: {
    valid: boolean;
    errors: string[];
    data: any;
  };
  inputQueryFixtureMatch: {
    valid: boolean;
    errors: string[];
    generatedQuery?: string;
  };
  outputFixture: {
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
 *   - inputFixture: { valid: boolean, errors: Array, data: Object } - Input fixture validation results
 *   - inputQueryFixtureMatch: { valid: boolean, errors: Array } - Input query-fixture structure match results
 *   - outputFixture: { valid: boolean, errors: Array, mutationName: string, resultParameterType: string } - Output fixture validation results
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
    inputFixture: { valid: false, errors: [], data: null },
    inputQueryFixtureMatch: { valid: false, errors: [] },
    outputFixture: { valid: false, errors: [], mutationName: null, resultParameterType: null }
  };

  try {
    // Step 1: Validate input query
    const inputQueryErrors = validateInputQuery(inputQueryAST, schema);
    results.inputQuery = {
      valid: inputQueryErrors.length === 0,
      errors: inputQueryErrors
    };

    // Step 2: Validate query-fixture structure match to get validation, query, and normalized data in one pass
    const traversalResult = validateFixtureInputStructure(inputQueryAST, schema, fixture.input);

    // Step 3: Store input query-fixture structure match results
    results.inputQueryFixtureMatch = {
      valid: traversalResult.valid,
      errors: traversalResult.errors,
      generatedQuery: traversalResult.generatedQuery
    };

    // Step 4: Validate input fixture types using traversal results
    // Pass variable values from fixture if present
    const inputFixtureResult = await validateFixtureInputTypes(
      traversalResult.generatedQuery,
      schema,
      fixture.input,
      fixture.inputQueryVariables
    );
    results.inputFixture = {
      valid: inputFixtureResult.valid,
      errors: inputFixtureResult.errors,
      data: inputFixtureResult.data
    };

    // Step 5: Determine mutation details for output validation
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

    // Step 6: Validate output fixture
    if (!results.mutationName || !results.resultParameterName) {
      throw new Error('Unable to determine mutation name or result parameter name for output fixture validation');
    }
    
    const outputFixtureResult = await validateFixtureOutput(
      fixture.expectedOutput, 
      schema, 
      results.mutationName, 
      results.resultParameterName
    );
    results.outputFixture = {
      valid: outputFixtureResult.valid,
      errors: outputFixtureResult.errors,
      mutationName: outputFixtureResult.mutationName,
      resultParameterType: outputFixtureResult.resultParameterType
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



import { validateInputQuery } from "./validate-input-query.js";
import { validateFixtureOutput } from "./validate-fixture-output.js";
import { validateFixtureInput } from "./validate-fixture-input.js";
import { determineMutationFromTarget } from "../utils/determine-mutation-from-target.js";
import { GraphQLSchema, GraphQLError, DocumentNode } from "graphql";
import { FixtureData } from "./load-fixture.js";

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
    errors: readonly GraphQLError[];
  };
  inputFixture: {
    errors: string[];
  };
  outputFixture: {
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
 * 2. Validates the input fixture data against the schema and query structure
 * 3. Validates the output fixture data against the specified mutation
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
 *   - inputQuery: { errors: Array } - Input query validation results (empty array if valid)
 *   - inputFixture: { errors: Array } - Input fixture validation results (includes query-fixture structure match, empty array if valid)
 *   - outputFixture: { errors: Array, mutationName: string, resultParameterType: string } - Output fixture validation results (empty errors array if valid)
 */
export async function validateTestAssets({
  schema,
  fixture,
  inputQueryAST,
  mutationName,
  resultParameterName,
}: ValidateTestAssetsOptions): Promise<CompleteValidationResult> {
  const results: CompleteValidationResult = {
    mutationName,
    resultParameterName,
    inputQuery: { errors: [] },
    inputFixture: { errors: [] },
    outputFixture: {
      errors: [],
      mutationName: null,
      resultParameterType: null,
    },
  };

  try {
    // Step 1: Validate input query
    const inputQueryErrors = validateInputQuery(inputQueryAST, schema);
    results.inputQuery = {
      errors: inputQueryErrors,
    };

    // Step 2: Validate input fixture (which also validates query-fixture match)
    const inputFixtureResult = validateFixtureInput(
      inputQueryAST,
      schema,
      fixture.input
    );
    results.inputFixture = {
      errors: inputFixtureResult.errors,
    };

    // Step 3: Determine mutation details for output validation
    let determined;
    if (!mutationName || !resultParameterName) {
      const target = fixture.target;
      if (!target) {
        throw new Error(
          "Fixture must contain target when mutationName and resultParameterName are not provided"
        );
      }

      determined = determineMutationFromTarget(target, schema);
    }

    results.mutationName = mutationName || determined?.mutationName;
    results.resultParameterName =
      resultParameterName || determined?.resultParameterName;

    // Step 5: Validate output fixture
    if (!results.mutationName || !results.resultParameterName) {
      throw new Error(
        "Unable to determine mutation name or result parameter name for output fixture validation"
      );
    }

    const outputFixtureResult = await validateFixtureOutput(
      fixture.expectedOutput,
      schema,
      results.mutationName,
      results.resultParameterName
    );
    results.outputFixture = {
      errors: outputFixtureResult.errors,
      mutationName: outputFixtureResult.mutationName,
      resultParameterType: outputFixtureResult.resultParameterType,
    };

    return results;
  } catch (error) {
    // Handle file loading or parsing errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ...results,
      error: errorMessage,
    };
  }
}

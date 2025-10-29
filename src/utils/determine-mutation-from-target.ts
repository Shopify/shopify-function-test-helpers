import { isObjectType, GraphQLSchema } from "graphql";

/**
 * Interface for mutation determination result
 */
export interface MutationTarget {
  mutationName: string;
  resultParameterName: string;
}

/**
 * Determines the mutation name and result parameter name from a target string and GraphQL schema
 * by analyzing the schema's mutation comments and field definitions.
 *
 * @param {string} target - The target string (e.g., "cart.validations.generate.run")
 * @param {GraphQL.GraphQLSchema} schema - The GraphQL schema to analyze
 * @returns {Object} Object with structure:
 *   - mutationName: string - The name of the matching mutation field
 *   - resultParameterName: string - The name of the first parameter (typically 'result')
 * @throws {Error} If target cannot be matched to a mutation or schema has no mutations
 */
export function determineMutationFromTarget(
  target: string,
  schema: GraphQLSchema,
): MutationTarget {
  try {
    // Get the mutation type from the schema
    const mutationType = schema.getMutationType();
    if (!mutationType || !isObjectType(mutationType)) {
      throw new Error("Schema does not define a Mutation type");
    }

    // Get all mutation fields
    const mutationFields = mutationType.getFields();

    // Look for a mutation that matches the target
    for (const [mutationName, mutationField] of Object.entries(
      mutationFields,
    )) {
      // Check if this mutation's description/comment mentions the target
      const description = mutationField.description || "";

      // Look for target pattern in the description
      // Example: "Handles the Function result for the cart.validations.generate.run target."
      if (description.includes(target)) {
        // Get the parameter name from the mutation's arguments
        const args = mutationField.args;
        if (args.length === 0) {
          throw new Error(`Mutation '${mutationName}' has no arguments`);
        }

        // Use the first argument's name as the result parameter name
        const resultParameterName = args[0].name;

        return {
          mutationName,
          resultParameterName,
        };
      }
    }

    throw new Error(
      `No mutation found for target '${target}'. Make sure the schema contains a mutation with a description that includes this target.`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to determine mutation from target '${target}': ${errorMessage}`,
    );
  }
}

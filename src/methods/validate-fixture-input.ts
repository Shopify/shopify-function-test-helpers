import { visit, DocumentNode, Kind } from "graphql";
import { TypeInfo, visitWithTypeInfo, coerceInputValue } from "graphql";
import {
  isInputType,
  isListType,
  isNullableType,
  GraphQLSchema,
  GraphQLType,
  getNullableType,
  isAbstractType,
  getNamedType,
} from "graphql";
import { inlineNamedFragmentSpreads } from "../utils/inline-named-fragment-spreads.js";

export interface ValidateFixtureInputResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that fixture input data matches the structure and types defined in a GraphQL query.
 *
 * @param queryAST - The parsed GraphQL query document that defines the expected data structure
 * @param schema - The GraphQL schema containing type definitions
 * @param value - The fixture data to validate against the query
 * @returns A result object containing a validity flag and any validation errors
 *
 * @remarks
 * The validator traverses the query AST using the GraphQL visitor pattern and validates
 * the corresponding fixture data at each field.
 */
export function validateFixtureInput(
  queryAST: DocumentNode,
  schema: GraphQLSchema,
  value: any
): ValidateFixtureInputResult {
  const inlineFragmentSpreadsAst = inlineNamedFragmentSpreads(queryAST);
  const typeInfo = new TypeInfo(schema);
  const valueStack: any[][] = [[value]];
  const errors: string[] = [];
  visit(
    inlineFragmentSpreadsAst,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node) {
          const currentValues = valueStack[valueStack.length - 1];
          const nestedValues = [];

          const responseKey = node.alias?.value || node.name.value;

          const fieldDefinition = typeInfo.getFieldDef();
          const fieldType = fieldDefinition?.type;

          for (const currentValue of currentValues) {
            const valueForResponseKey = currentValue[responseKey];

            if (valueForResponseKey === undefined) {
              errors.push(`Missing expected fixture data for ${responseKey}`);
              continue;
            } else if (isInputType(fieldType)) {
              // Although we are validating output values (fixture data), we can use coerceInputValue
              // because the only output types that return true for isInputType are:
              // built-in scalars, custom scalars, enums, and list/nullable wrappers of these. 
              // For these types, input coercion and output validation are equivalent.
              coerceInputValue(
                valueForResponseKey,
                fieldType,
                (path, _invalidValue, error) => {
                  errors.push(`${error.message} At "${path.join(".")}"`);
                }
              );
            } else if (
              isNullableType(fieldType) &&
              valueForResponseKey === null
            ) {
              continue;
            } else if (fieldType && isListType(getNullableType(fieldType))) {
              if (Array.isArray(valueForResponseKey)) {
                const flattened = flattenNestedArrays(valueForResponseKey, fieldType);
                nestedValues.push(...flattened);
              } else {
                errors.push(
                  `Expected array for ${responseKey}, but got ${typeof valueForResponseKey}`
                );
              }
            } else {
              if (typeof valueForResponseKey === "object") {
                nestedValues.push(valueForResponseKey);
              } else {
                errors.push(
                  `Expected object for ${responseKey}, but got ${typeof valueForResponseKey}`
                );
              }
            }
          }

          valueStack.push(nestedValues);
        },
        leave() {
          valueStack.pop();
        },
      },
      SelectionSet: {
        enter(node) {
          if (isAbstractType(getNamedType(typeInfo.getType()))) {
            const hasTypename = node.selections.some(
              (selection) =>
                selection.kind == Kind.FIELD &&
                selection.name.value == "__typename"
            );

            const fragmentSpreadCount = node.selections.filter(
              (selection) =>
                selection.kind == Kind.FRAGMENT_SPREAD ||
                selection.kind == Kind.INLINE_FRAGMENT
            ).length;

            if (!hasTypename && fragmentSpreadCount > 1) {
              errors.push(
                `Missing __typename field for abstract type ${getNamedType(typeInfo.getType())?.name}`
              );
            }
          }
        },
      },
    })
  );
  return { valid: errors.length === 0, errors };
}

/**
 * Recursively flattens nested arrays until we reach the leaf values.
 *
 * @param value - The fixture data value (possibly nested arrays)
 * @param type - The GraphQL type (possibly nested list types)
 * @returns A flat array of leaf values
 *
 * @remarks
 * This is necessary because the GraphQL visitor traverses the query structure,
 * not the data structure. When visiting a field inside a `[[T]]` type,
 * the visitor expects `currentValues` to contain T objects, not arrays.
 *
 * Without recursive flattening:
 * - After one spread of [[T]], we'd have [Array, Array] in currentValues
 * - Trying to access array['someField'] returns undefined, causing "missing field" errors
 *
 * With recursive flattening:
 * - We fully flatten [[T]] to [T, T, ...]
 * - Accessing T['someField'] correctly retrieves the value
 */
function flattenNestedArrays(
  value: any,
  type: GraphQLType
): any[] {
  const result: any[] = [];
  const unwrappedType = getNullableType(type);

  if (isListType(unwrappedType)) {
    // Still a list type - need to go deeper
    if (Array.isArray(value)) {
      for (const item of value) {
        // Recursively flatten each item
        result.push(...flattenNestedArrays(item, unwrappedType.ofType));
      }
    }
  } else {
    // Reached the leaf type - spread the current level
    if (Array.isArray(value)) {
      result.push(...value);
    } else {
      result.push(value);
    }
  }

  return result;
}
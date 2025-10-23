import { visit, DocumentNode, Kind } from "graphql";
import { TypeInfo, visitWithTypeInfo, coerceInputValue } from "graphql";
import {
  isInputType,
  isListType,
  isNullableType,
  GraphQLSchema,
  GraphQLList,
  getNullableType,
  isAbstractType,
  isObjectType,
  getNamedType,
} from "graphql";
import { inlineNamedFragmentSpreads } from "../utils/inline-named-fragment-spreads.js";

export interface ValidateFixtureInputResult {
  errors: string[];
}

/**
 * Validates that fixture input data matches the structure and types defined in a GraphQL query.
 *
 * @param queryAST - The parsed GraphQL query document that defines the expected data structure
 * @param schema - The GraphQL schema containing type definitions
 * @param value - The fixture data to validate against the query
 * @returns A result object containing any validation errors (empty array if valid)
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

            // Field is missing from fixture
            if (valueForResponseKey === undefined) {
              errors.push(`Missing expected fixture data for ${responseKey}`);
            }
            // Scalars and Enums (including wrapped types)
            else if (isInputType(fieldType)) {
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
            }
            // Nullable fields with null value
            else if (
              isNullableType(fieldType) &&
              valueForResponseKey === null
            ) {
              // null is valid for nullable types, nothing to do
            }
            // Objects, Lists of objects
            else if (fieldType) {
              const unwrappedFieldType = getNullableType(fieldType);

              // Lists - process recursively
              if (isListType(unwrappedFieldType)) {
                if (Array.isArray(valueForResponseKey)) {
                  const { values: flattened, errors: flattenErrors } = processNestedArrays(
                    valueForResponseKey,
                    unwrappedFieldType,
                    responseKey
                  );
                  nestedValues.push(...flattened);
                  errors.push(...flattenErrors);
                } else {
                  errors.push(
                    `Expected array for ${responseKey}, but got ${typeof valueForResponseKey}`
                  );
                }
              }
              // Objects - validate and add to traversal stack
              // Note: Abstract types (unions/interfaces) are handled in a limited way.
              // We add them to the traversal stack but don't use __typename to discriminate
              // between concrete types. This works for simple cases where all items are the
              // same type, but doesn't support mixed-type arrays (see skipped test).
              else if (isObjectType(unwrappedFieldType) || isAbstractType(unwrappedFieldType)) {
                if (valueForResponseKey === null) {
                  errors.push(`Expected object for ${responseKey}, but got null`);
                } else if (typeof valueForResponseKey === "object") {
                  nestedValues.push(valueForResponseKey);
                } else {
                  errors.push(`Expected object for ${responseKey}, but got ${typeof valueForResponseKey}`);
                }
              }
              // Unexpected type - defensive check that should never be reached
              else {
                errors.push(`Unexpected type for ${responseKey}: ${unwrappedFieldType}`);
              }
            }
            // No type information - should not happen with valid query
            else {
              errors.push(`Cannot validate ${responseKey}: missing type information`);
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
  return { errors };
}

/**
 * Recursively processes nested arrays by flattening them.
 * Validates nullability constraints as it goes - reports errors for invalid nulls.
 * Filters out all nulls since they have no field values to validate.
 *
 * @param value - The fixture data value (possibly nested arrays)
 * @param listType - The GraphQL list type (e.g., [Item] or [[Item]])
 * @param fieldName - The field name for error messages
 * @returns Object with flattened values and any validation errors
 *
 * @example
 * For `items: [Item]`:
 * - listType = [Item] (the list type passed in)
 * - elementType = Item (extracted via listType.ofType)
 * - Recursion stops here (Item is not a list type)
 *
 * For `itemMatrix: [[Item]]`:
 * - listType = [[Item]] (the list type passed in)
 * - elementType = [Item] (extracted via listType.ofType)
 * - Recursion continues (elementType is still a list type)
 *
 * @remarks
 * This is necessary because the GraphQL visitor traverses the query structure,
 * not the data structure. When visiting a field inside a `[[T]]` type,
 * the visitor expects `currentValues` to contain T objects, not arrays.
 */
function processNestedArrays(
  value: any[],
  listType: GraphQLList<any>,
  fieldName: string
): { values: any[]; errors: string[] } {
  const result: any[] = [];
  const errors: string[] = [];
  const elementType = listType.ofType;

  for (const [index, element] of value.entries()) {
    if (element === null) {
      if (!isNullableType(elementType)) {
        errors.push(
          `Null value found in non-nullable array at ${fieldName}[${index}]`
        );
      }
    } else {
      if (isListType(elementType)) {
        // Element type is a list - expect nested array and recurse
        if (Array.isArray(element)) {
          const nested = processNestedArrays(element, elementType, `${fieldName}[${index}]`);
          result.push(...nested.values);
          errors.push(...nested.errors);
        } else {
          // Error: fixture structure doesn't match schema nesting
          errors.push(`Expected array at ${fieldName}[${index}], but got ${typeof element}`);
        }
      } else {
        // Non-list type - add directly
        result.push(element);
      }
    }
  }

  return { values: result, errors };
}
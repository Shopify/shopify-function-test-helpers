import "core-js/actual/set/intersection.js";
import "core-js/actual/set/symmetric-difference.js";
import {
  coerceInputValue,
  DocumentNode,
  getNamedType,
  getNullableType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLSchema,
  isAbstractType,
  isInputType,
  isLeafType,
  isListType,
  isNullableType,
  isObjectType,
  Kind,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  BREAK,
} from "graphql";

import { inlineNamedFragmentSpreads } from "../utils/inline-named-fragment-spreads.js";

export interface ValidateFixtureInputResult {
  errors: string[];
}

/**
 * Tracks expected fields at a selection set level, distinguishing between:
 * - common fields (selected outside inline fragments)
 * - type-specific fields (selected inside inline fragments)
 */
interface ExpectedFields {
  common: Set<string>;  // Fields that should be present on all objects
  byType: Map<GraphQLNamedType, { fields: Set<string>, possibleTypes: Set<string> }>;  // Fields specific to inline fragment types
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
  value: any,
): ValidateFixtureInputResult {
  const inlineFragmentSpreadsAst = inlineNamedFragmentSpreads(queryAST);
  const typeInfo = new TypeInfo(schema);
  const valueStack: any[][] = [[value]];
  // based on field depth
  const typeStack: (GraphQLNamedType | undefined)[] = [];
  // based on selection set depth
  const possibleTypesStack: Set<string>[] = [
    new Set([schema.getQueryType()!.name]),
  ];
  const typenameResponseKeyStack: (string | undefined)[] = [];
  const expectedFieldsStack: ExpectedFields[] = [{ common: new Set(), byType: new Map() }];
  const typeConditionStack: (GraphQLNamedType | null)[] = [null];

  const errors: string[] = [];

  visit(
    inlineFragmentSpreadsAst,
    visitWithTypeInfo(typeInfo, {
      InlineFragment: {
        enter(node) {
          let possibleTypes = new Set(possibleTypesStack[possibleTypesStack.length - 1]);
          let namedType: GraphQLNamedType | undefined;

          if (node.typeCondition !== null && node.typeCondition !== undefined) {
            namedType = schema.getType(node.typeCondition.name.value);

            if (namedType) {
              if (isAbstractType(namedType)) {
                possibleTypes = possibleTypes.intersection(new Set(schema.getPossibleTypes(namedType).map(type => type.name)));
              } else if (isObjectType(namedType)) {
                possibleTypes = new Set([namedType.name]);
              }
            }
          }
          possibleTypesStack.push(possibleTypes);
          typeConditionStack.push(namedType ?? null);
        },
        leave() {
          possibleTypesStack.pop();
          typeConditionStack.pop();
        },
      },
      Field: {
        enter(node) {
          const currentValues = valueStack[valueStack.length - 1];
          const nestedValues = [];

          const responseKey = node.alias?.value || node.name.value;

          // Track this field in the appropriate set based on whether we're in an inline fragment
          const currentExpectedFields = expectedFieldsStack[expectedFieldsStack.length - 1];
          const currentFragmentType = typeConditionStack[typeConditionStack.length - 1];

          if (currentFragmentType) {
            // Inside an inline fragment - add to type-specific set
            if (!currentExpectedFields.byType.has(currentFragmentType)) {
              const fragmentPossibleTypes = possibleTypesStack[possibleTypesStack.length - 1];
              currentExpectedFields.byType.set(currentFragmentType, {
                fields: new Set(),
                possibleTypes: fragmentPossibleTypes
              });
            }
            currentExpectedFields.byType.get(currentFragmentType)!.fields.add(responseKey);
          } else {
            // Outside inline fragments - add to common fields
            currentExpectedFields.common.add(responseKey);
          }

          const fieldDefinition = typeInfo.getFieldDef();
          if (fieldDefinition === undefined || fieldDefinition === null) {
            errors.push(
              `Cannot validate ${responseKey}: missing field definition`,
            );
            return BREAK;
          }
          const fieldType = fieldDefinition.type;

          for (const currentValue of currentValues) {
            const valueForResponseKey = currentValue[responseKey];

            // Field is missing from fixture
            if (valueForResponseKey === undefined) {
              const typenameResponseKey =
                typenameResponseKeyStack[typenameResponseKeyStack.length - 1];
              const parentFieldType = typeStack[typeStack.length - 1]!;
              const possibleTypes =
                possibleTypesStack[possibleTypesStack.length - 1];
              if (
                isValueExpectedForType(
                  currentValue,
                  parentFieldType,
                  possibleTypes,
                  schema,
                  typenameResponseKey,
                )
              ) {
                errors.push(`Missing expected fixture data for ${responseKey}`);
              }
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
                },
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
                  const { values: flattened, errors: flattenErrors } =
                    processNestedArrays(
                      valueForResponseKey,
                      unwrappedFieldType,
                      responseKey,
                    );
                  nestedValues.push(...flattened);
                  errors.push(...flattenErrors);
                } else {
                  errors.push(
                    `Expected array for ${responseKey}, but got ${typeof valueForResponseKey}`,
                  );
                }
              }
              // Objects - validate and add to traversal stack
              else if (
                isObjectType(unwrappedFieldType) ||
                isAbstractType(unwrappedFieldType)
              ) {
                if (valueForResponseKey === null) {
                  errors.push(
                    `Expected object for ${responseKey}, but got null`,
                  );
                } else if (typeof valueForResponseKey === "object") {
                  nestedValues.push(valueForResponseKey);
                } else {
                  errors.push(
                    `Expected object for ${responseKey}, but got ${typeof valueForResponseKey}`,
                  );
                }
              }
              // Unexpected type - defensive check that should never be reached
              else {
                errors.push(
                  `Unexpected type for ${responseKey}: ${unwrappedFieldType}`,
                );
              }
            }
            // No type information - should not happen with valid query
            else {
              errors.push(
                `Cannot validate ${responseKey}: missing type information`,
              );
            }
          }

          const namedType = getNamedType(fieldType);
          let possibleTypes: string[] = [];
          if (isLeafType(namedType)) {
            // do nothing
          } else if (isAbstractType(namedType)) {
            possibleTypes = schema
              .getPossibleTypes(namedType)
              .map((type) => type.name);
          } else if (isObjectType(namedType)) {
            possibleTypes = [namedType.name];
          }

          possibleTypesStack.push(new Set(possibleTypes));
          typeStack.push(getNamedType(fieldType));

          valueStack.push(nestedValues);
          return undefined;
        },
        leave() {
          valueStack.pop();
          typeStack.pop();
          possibleTypesStack.pop();
        },
      },
      SelectionSet: {
        enter(node, _key, parent) {
          // If this SelectionSet belongs to a Field, prepare to track expected fields
          if (parent && 'kind' in parent && parent.kind === Kind.FIELD) {
            expectedFieldsStack.push({ common: new Set(), byType: new Map() });
            typeConditionStack.push(null);
          }

          // Look ahead to find __typename field and track its response key
          const typenameField = node.selections.find(
            (selection) =>
              selection.kind === Kind.FIELD &&
              selection.name.value === "__typename",
          );

          let typenameResponseKey: string | undefined;
          if (typenameField?.kind === Kind.FIELD) {
            typenameResponseKey = typenameField.alias?.value || "__typename";
          } else if (
            parent &&
            "kind" in parent &&
            parent.kind === Kind.INLINE_FRAGMENT
          ) {
            // Inside an inline fragment without __typename - inherit from parent SelectionSet
            typenameResponseKey =
              typenameResponseKeyStack[typenameResponseKeyStack.length - 1];
          } else {
            // Field SelectionSet or root level - don't inherit (new object context)
            typenameResponseKey = undefined;
          }

          typenameResponseKeyStack.push(typenameResponseKey);

          if (isAbstractType(getNamedType(typeInfo.getType()))) {
            const hasTypename = node.selections.some(
              (selection) =>
                selection.kind === Kind.FIELD &&
                selection.name.value === "__typename",
            );

            const fragmentSpreadCount = node.selections.filter(
              (selection) =>
                selection.kind === Kind.FRAGMENT_SPREAD ||
                selection.kind === Kind.INLINE_FRAGMENT,
            ).length;

            if (!hasTypename && fragmentSpreadCount > 1) {
              errors.push(
                `Missing __typename field for abstract type ${getNamedType(typeInfo.getType())?.name}`,
              );
              return BREAK;
            }
          }
          return undefined;
        },
        leave(_node, _key, parent) {
          // If this SelectionSet belongs to a Field, validate for extra fields
          if (parent && 'kind' in parent && parent.kind === Kind.FIELD) {
            const expectedFields = expectedFieldsStack.pop()!;
            const nestedValues = valueStack[valueStack.length - 1];
            const typenameResponseKey = typenameResponseKeyStack[typenameResponseKeyStack.length - 1];
            errors.push(...checkForExtraFields(nestedValues, expectedFields, typenameResponseKey));

            typeConditionStack.pop();
          }

          typenameResponseKeyStack.pop();
        },
      },
    }),
  );

  // The query's root SelectionSet has no parent Field node, so there's no Field.leave event to check it.
  // We manually perform the same check here that would happen in Field.leave for nested objects.
  const rootTypenameResponseKey = typenameResponseKeyStack[typenameResponseKeyStack.length - 1];
  errors.push(...checkForExtraFields(valueStack[0], expectedFieldsStack[0], rootTypenameResponseKey));

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
  fieldName: string,
): { values: any[]; errors: string[] } {
  const result: any[] = [];
  const errors: string[] = [];
  const elementType = listType.ofType;

  for (const [index, element] of value.entries()) {
    if (element === null) {
      if (!isNullableType(elementType)) {
        errors.push(
          `Null value found in non-nullable array at ${fieldName}[${index}]`,
        );
      }
    } else if (isListType(elementType)) {
      // Element type is a list - expect nested array and recurse
      if (Array.isArray(element)) {
        const nested = processNestedArrays(
          element,
          elementType,
          `${fieldName}[${index}]`,
        );
        result.push(...nested.values);
        errors.push(...nested.errors);
      } else {
        // Error: fixture structure doesn't match schema nesting
        errors.push(
          `Expected array at ${fieldName}[${index}], but got ${typeof element}`,
        );
      }
    } else {
      // Non-list type - add directly
      result.push(element);
    }
  }

  return { values: result, errors };
}

/**
 * Determines if a fixture value is expected
 *
 * @param fixtureValue - The fixture value to check
 * @param parentFieldType - The type returned by the parent field (e.g., InterfaceImplementersUnion from `interfaceImplementers` field)
 * @param possibleTypes - Set of possible type names after inline fragment narrowing (e.g., {"InterfaceImplementer1"} after `...on HasDescription`)
 * @param schema - The GraphQL schema to resolve possible types for abstract types
 * @param typenameKey - The response key for the __typename field (supports aliases like `type: __typename`)
 * @returns True if the value is expected (field should be present), false otherwise (field can be skipped)
 *
 * @remarks
 * When __typename is selected:
 * - Checks if value's __typename is in the possibleTypes set
 *
 * When __typename is NOT selected:
 * - Compares parent field's possible types vs current possibleTypes
 * - If sets differ (narrowing occurred), empty objects {} are valid (return false)
 * - Non-empty objects conservatively expect all fields (return true)
 * - Since typeStack only tracks fields (not inline fragments), parentFieldType is the original
 *   field's type, enabling correct narrowing detection at any nesting depth
 */
function isValueExpectedForType(
  fixtureValue: any,
  parentFieldType: GraphQLNamedType,
  possibleTypes: Set<string>,
  schema: GraphQLSchema,
  typenameKey?: string,
): boolean {
  if (!typenameKey) {
    let parentFieldPossibleTypes: string[] = [];
    if (isAbstractType(parentFieldType)) {
      parentFieldPossibleTypes = schema
        .getPossibleTypes(parentFieldType)
        .map((type) => type.name);
    } else {
      parentFieldPossibleTypes = [parentFieldType.name];
    }

    const parentFieldPossibleTypesSet = new Set(parentFieldPossibleTypes);
    const difference =
      parentFieldPossibleTypesSet.symmetricDifference(possibleTypes);

    if (difference.size > 0 && Object.keys(fixtureValue).length === 0) {
      return false;
    }

    return true; // Otherwise, expect all values
  }

  const valueTypename = fixtureValue[typenameKey];
  if (!valueTypename) {
    // No __typename in value - can't discriminate, so expect it
    return true;
  }

  return possibleTypes.has(valueTypename);
}

/**
 * Checks fixture objects for fields that are not present in the GraphQL query.
 * Supports type discrimination for abstract types (unions/interfaces) using __typename.
 *
 * @param fixtureObjects - Array of fixture objects to validate
 * @param expectedFields - Expected fields structure with common fields and type-specific fields
 * @param typenameResponseKey - The response key for the __typename field (supports aliases like `type: __typename`)
 * @returns Array of error messages for any extra fields found (empty if valid)
 *
 * @remarks
 * - Only validates object types - skips null values and arrays
 * - Uses __typename to determine which inline fragment fields apply to each object
 * - Common fields (outside inline fragments) are expected on all objects
 * - Type-specific fields (inside inline fragments) are only expected on matching types
 * - No schema lookups needed - possible types were pre-computed during traversal
 */
function checkForExtraFields(
  fixtureObjects: any[],
  expectedFields: ExpectedFields,
  typenameResponseKey: string | undefined
): string[] {
  const errors: string[] = [];

  for (const fixtureObject of fixtureObjects) {
    if (typeof fixtureObject === "object" && fixtureObject !== null && !Array.isArray(fixtureObject)) {
      const fixtureFields = Object.keys(fixtureObject);

      // Build the set of expected fields for this specific object
      const expectedForThisObject = new Set(expectedFields.common);

      const objectTypename = typenameResponseKey ? fixtureObject[typenameResponseKey] : fixtureObject.__typename;

      if (objectTypename) {
        // Object has __typename - check which fragment types match
        for (const { fields, possibleTypes } of expectedFields.byType.values()) {
          if (possibleTypes.has(objectTypename)) {
            fields.forEach(field => expectedForThisObject.add(field));
          }
        }
      } else if (expectedFields.byType.size > 0) {
        // No __typename - allow union of all fragment fields
        // Without __typename we can't discriminate which fragment applies
        // Note: We use > 0 (not === 1) to handle nested fragments (e.g., ... on HasId { ... on HasName { ... }})
        // where byType.size can be > 1. For 2+ sibling fragments (e.g., ... on Item / ... on Metadata)
        // without __typename, validation BREAKs early (line 277) to enforce __typename requirement.
        expectedFields.byType.forEach(({ fields }) => {
          fields.forEach(field => expectedForThisObject.add(field));
        });
      }

      // Check each field in the fixture object
      for (const fixtureField of fixtureFields) {
        if (!expectedForThisObject.has(fixtureField)) {
          errors.push(`Extra field "${fixtureField}" found in fixture data not in query`);
        }
      }
    }
  }

  return errors;
}

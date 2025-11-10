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
  ASTNode,
} from "graphql";

import { inlineNamedFragmentSpreads } from "../utils/inline-named-fragment-spreads.js";

export interface FixtureInputValidationError {
  message: string;
  path: (string | number)[];
}

export interface ValidateFixtureInputResult {
  errors: FixtureInputValidationError[];
}

interface NestedValue {
  value: any;
  path: (string | number)[];
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
  const valueStack: NestedValue[][] = [[{ value, path: [] }]];
  const typeStack: (GraphQLNamedType | undefined)[] = [];
  const possibleTypesStack: Set<string>[] = [
    new Set([schema.getQueryType()!.name]),
  ];
  const typenameResponseKeyStack: (string | undefined)[] = [];
  const expectedFieldsStack: Map<string, Set<string>>[] = [new Map()];

  const errors: FixtureInputValidationError[] = [];

  visit(
    inlineFragmentSpreadsAst,
    visitWithTypeInfo(typeInfo, {
      InlineFragment: {
        enter(node) {
          let possibleTypes = new Set(
            possibleTypesStack[possibleTypesStack.length - 1],
          );

          if (node.typeCondition !== null && node.typeCondition !== undefined) {
            const namedType = schema.getType(node.typeCondition.name.value);

            if (namedType) {
              if (isAbstractType(namedType)) {
                possibleTypes = possibleTypes.intersection(
                  new Set(
                    schema.getPossibleTypes(namedType).map((type) => type.name),
                  ),
                );
              } else if (isObjectType(namedType)) {
                possibleTypes = new Set([namedType.name]);
              }
            }
          }
          possibleTypesStack.push(possibleTypes);
        },
        leave() {
          possibleTypesStack.pop();
        },
      },
      Field: {
        enter(node, _key, _parent, _path, ancestors) {
          const currentValues = valueStack[valueStack.length - 1];
          const nestedValues = [];

          const responseKey = node.alias?.value || node.name.value;

          // Track this field in the appropriate set based on whether we're in an inline fragment
          const currentExpectedFields =
            expectedFieldsStack[expectedFieldsStack.length - 1];
          const currentPossibleTypes =
            possibleTypesStack[possibleTypesStack.length - 1];

          for (const concreteTypeName of currentPossibleTypes) {
            if (!currentExpectedFields.has(concreteTypeName)) {
              currentExpectedFields.set(concreteTypeName, new Set());
            }
            currentExpectedFields.get(concreteTypeName)!.add(responseKey);
          }

          const fieldDefinition = typeInfo.getFieldDef();
          if (fieldDefinition === undefined || fieldDefinition === null) {
            const currentPath = pathFromAncestors(ancestors);
            errors.push({
              message: `Cannot validate ${responseKey}: missing field definition`,
              path: [...currentPath, responseKey],
            });
            return BREAK;
          }
          const fieldType = fieldDefinition.type;

          for (const {
            value: currentValue,
            path: currentPath,
          } of currentValues) {
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
                errors.push({
                  message: `Missing expected fixture data for ${responseKey}`,
                  path: [...currentPath, responseKey],
                });
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
                (_path, _invalidValue, error) => {
                  errors.push({
                    message: error.message,
                    path: [...currentPath, responseKey],
                  });
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
                      [...currentPath, responseKey],
                    );
                  nestedValues.push(...flattened);
                  errors.push(...flattenErrors);
                } else {
                  errors.push({
                    message: `Expected array, but got ${typeof valueForResponseKey}`,
                    path: [...currentPath, responseKey],
                  });
                }
              }
              // Objects - validate and add to traversal stack
              else if (
                isObjectType(unwrappedFieldType) ||
                isAbstractType(unwrappedFieldType)
              ) {
                if (valueForResponseKey === null) {
                  errors.push({
                    message: `Expected object, but got null`,
                    path: [...currentPath, responseKey],
                  });
                } else if (typeof valueForResponseKey === "object") {
                  nestedValues.push({
                    value: valueForResponseKey,
                    path: [...currentPath, responseKey],
                  });
                } else {
                  errors.push({
                    message: `Expected object, but got ${typeof valueForResponseKey}`,
                    path: [...currentPath, responseKey],
                  });
                }
              }
              // Unexpected type - defensive check that should never be reached
              else {
                errors.push({
                  message: `Unexpected type, expected ${unwrappedFieldType}`,
                  path: [...currentPath, responseKey],
                });
              }
            }
            // No type information - should not happen with valid query
            else {
              errors.push({
                message: `Cannot validate ${responseKey}: missing type information`,
                path: [...currentPath, responseKey],
              });
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
        enter(node, _key, parent, _path, ancestors) {
          // If this SelectionSet belongs to a Field, prepare to track expected fields
          if (parent && "kind" in parent && parent.kind === Kind.FIELD) {
            expectedFieldsStack.push(new Map());
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
              const currentPath = pathFromAncestors([...ancestors, parent!]);
              errors.push({
                message: `Missing __typename field for abstract type ${getNamedType(typeInfo.getType())?.name}`,
                path: currentPath,
              });
              return BREAK;
            }
          }
          return undefined;
        },
        leave(_node, _key, parent) {
          // If this SelectionSet belongs to a Field or is the root (OperationDefinition), validate for extra fields
          if (
            parent &&
            "kind" in parent &&
            (parent.kind === Kind.FIELD ||
              parent.kind === Kind.OPERATION_DEFINITION)
          ) {
            const expectedFields = expectedFieldsStack.pop()!;
            const nestedValues = valueStack[valueStack.length - 1];
            const typenameResponseKey =
              typenameResponseKeyStack[typenameResponseKeyStack.length - 1];
            errors.push(
              ...checkForExtraFields(
                nestedValues,
                expectedFields,
                typenameResponseKey,
              ),
            );
          }

          typenameResponseKeyStack.pop();
        },
      },
    }),
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
  path: (string | number)[],
): { values: NestedValue[]; errors: FixtureInputValidationError[] } {
  const nestedValues: NestedValue[] = [];
  const errors: FixtureInputValidationError[] = [];
  const elementType = listType.ofType;

  for (const [index, element] of value.entries()) {
    if (element === null) {
      if (!isNullableType(elementType)) {
        errors.push({
          message: "Null value found in non-nullable array",
          path: [...path, index],
        });
      }
    } else if (isListType(elementType)) {
      // Element type is a list - expect nested array and recurse
      if (Array.isArray(element)) {
        const nested = processNestedArrays(element, elementType, [
          ...path,
          index,
        ]);
        nestedValues.push(...nested.values);
        errors.push(...nested.errors);
      } else {
        // Error: fixture structure doesn't match schema nesting
        errors.push({
          message: `Expected array, but got ${typeof element}`,
          path: [...path, index],
        });
      }
    } else {
      // Non-list type - add directly
      nestedValues.push({ value: element, path: [...path, index] });
    }
  }

  return { values: nestedValues, errors };
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
  fixtureObjects: NestedValue[],
  expectedFields: Map<string, Set<string>>,
  typenameResponseKey: string | undefined,
): FixtureInputValidationError[] {
  const errors: FixtureInputValidationError[] = [];

  for (const { value: fixtureObject, path } of fixtureObjects) {
    if (
      typeof fixtureObject === "object" &&
      fixtureObject !== null &&
      !Array.isArray(fixtureObject)
    ) {
      const fixtureFields = Object.keys(fixtureObject);

      // Build the set of expected fields for this specific object
      let expectedForThisObject = new Set();

      const objectTypename = typenameResponseKey
        ? fixtureObject[typenameResponseKey]
        : fixtureObject.__typename;

      if (objectTypename) {
        // Object has __typename - direct lookup by concrete type name
        const typeSpecificFields = expectedFields.get(objectTypename);
        if (typeSpecificFields) {
          expectedForThisObject = typeSpecificFields;
        }
      } else if (expectedFields.size > 0) {
        // No __typename - allow union of all fragment fields
        // Without __typename we can't discriminate which fragment applies
        // Note: We use > 0 (not === 1) to handle nested fragments (e.g., ... on HasId { ... on HasName { ... }})
        // where byType.size can be > 1. For 2+ sibling fragments (e.g., ... on Item / ... on Metadata)
        // without __typename, validation BREAKs early (line 277) to enforce __typename requirement.
        expectedFields.forEach((fields) => {
          fields.forEach((field) => expectedForThisObject.add(field));
        });
      }

      // Check each field in the fixture object
      for (const fixtureField of fixtureFields) {
        if (!expectedForThisObject.has(fixtureField)) {
          errors.push({
            message: `Extra field "${fixtureField}" found in fixture data not in query`,
            path: [...path, fixtureField],
          });
        }
      }
    }
  }

  return errors;
}

function pathFromAncestors(
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
): (string | number)[] {
  return ancestors
    .filter((ancestor) => "kind" in ancestor && ancestor.kind === Kind.FIELD)
    .map((ancestor) => ancestor.alias?.value || ancestor.name.value);
}

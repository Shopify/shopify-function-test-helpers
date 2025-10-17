import { visit, DocumentNode, Kind } from "graphql";
import { TypeInfo, visitWithTypeInfo, coerceInputValue } from "graphql";
import {
  isInputType,
  isListType,
  isNullableType,
  GraphQLSchema,
  getNullableType,
  isAbstractType,
  getNamedType,
} from "graphql";
import { inlineNamedFragmentSpreads } from "../utils/inline-named-fragment-spreads.js";

export interface ValidateFixtureResult {
  valid: boolean;
  errors: string[];
}

export function validateFixture(
  queryAST: DocumentNode,
  schema: GraphQLSchema,
  value: any
): ValidateFixtureResult {
  const inlineFragmentSpreadsAst = inlineNamedFragmentSpreads(queryAST);
  const typeInfo = new TypeInfo(schema);
  const valueStack: any[] = [[value]];
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
            } else if (isListType(getNullableType(fieldType))) {
              if (Array.isArray(valueForResponseKey)) {
                nestedValues.push(...valueForResponseKey);
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

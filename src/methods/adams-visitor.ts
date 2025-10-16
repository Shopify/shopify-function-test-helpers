import { parse, visit, BREAK } from 'graphql/language';
import { buildSchema, TypeInfo, visitWithTypeInfo, coerceInputValue } from 'graphql/utilities';
import { GraphQLScalarType, isInputType, GraphQLInputType, isLeafType, isListType, isNullableType } from 'graphql/type';
import { inlineNamedFragmentSpreads } from './inline-named-fragment-spreads';

export function visitQuery(query: string, schema: string, value: any): void {
    const parsedSchema = buildSchema(schema);
    const ast = parse(query);
    const inlineFragmentSpreadsAst = inlineNamedFragmentSpreads(ast);
    const typeInfo = new TypeInfo(parsedSchema);
    const valueStack: any[] = [[value]];
    visit(
        inlineFragmentSpreadsAst,
        visitWithTypeInfo(typeInfo, {
            Field: {
                enter(node, key, parent, path, ancestors) {
                    const currentValues = valueStack[valueStack.length - 1];
                    const nestedValues = [];

                    const responseKey = node.alias?.value || node.name.value;

                    console.log(`Response key: ${responseKey}`);
                    console.log(`Ancestors:`, ancestors);

                    const fieldDefinition = typeInfo.getFieldDef();
                    const fieldType = fieldDefinition?.type;

                    for (const currentValue of currentValues) {
                        const valueForResponseKey = currentValue[responseKey];

                        console.log(`Value for ${responseKey}:`, valueForResponseKey);

                        if (isInputType(fieldType)) {
                            coerceInputValue(valueForResponseKey, fieldType);
                        } else if (isNullableType(fieldType) && valueForResponseKey === null) {
                            continue;
                        } else if (isListType(fieldType)) {
                            if (Array.isArray(valueForResponseKey)) {
                                nestedValues.push(...valueForResponseKey);
                            } else {
                                throw new Error(`Expected array for ${responseKey}, but got ${typeof valueForResponseKey}`);
                            }
                        } else {
                            if (typeof valueForResponseKey === 'object') {
                                nestedValues.push(valueForResponseKey);
                            } else {
                                throw new Error(`Expected object for ${responseKey}, but got ${typeof valueForResponseKey}`);
                            }
                        }
                    }

                    valueStack.push(nestedValues);

                    // console.log(node, key, parent, path, ancestors);
                },
                leave(node, key, parent, path, ancestors) {
                    // console.log(node, key, parent, path, ancestors);
                    valueStack.pop();
                },
            }
        }),
    );
}

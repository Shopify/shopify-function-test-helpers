import { DocumentNode, FieldNode, SelectionNode, InlineFragmentNode, FragmentDefinitionNode, OperationDefinitionNode, FragmentSpreadNode, GraphQLSchema, print, isAbstractType, GraphQLType, getNamedType, GraphQLObjectType } from 'graphql';

/**
 * Result of validating fixture input structure
 */
export interface ValidateFixtureInputStructureResult {
  /** Whether the structure is valid (fixture matches query) */
  valid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** GraphQL query string generated from traversing the fixture structure */
  generatedQuery: string;
}

/**
 * Validate fixture input structure by traversing query and fixture together
 *
 * This function performs a single traversal that:
 * 1. Validates that fixture structure matches query structure
 * 2. Generates a GraphQL query string from the structure
 *
 * @param queryAST - The GraphQL query AST
 * @param schema - The GraphQL schema for type lookups
 * @param fixtureData - The fixture data to validate
 * @returns Result containing validation status, errors, and generated query
 */
export function validateFixtureInputStructure(
  queryAST: DocumentNode,
  schema: GraphQLSchema,
  fixtureData: Record<string, any>
): ValidateFixtureInputStructureResult {

  // Find the query operation 
  // - unsure if this is required since we should already catch this during validateInputQuery
  const queryOperation = queryAST.definitions.find(
    def => def.kind === 'OperationDefinition' && def.operation === 'query'
  ) as OperationDefinitionNode | undefined;

  if (!queryOperation) {
    return {
      valid: false,
      errors: ['No query operation found in AST'],
      generatedQuery: ''
    };
  }

  // Collect fragment definitions
  // - used to expand fragment spreads into selections
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of queryAST.definitions) {
    if (definition.kind === 'FragmentDefinition') {
      fragments.set(definition.name.value, definition);
    }
  }

  // Start traversal from the Query root type
  const queryType = schema.getQueryType();
  if (!queryType) {
    return {
      valid: false,
      errors: ['Schema does not have a Query root type'],
      generatedQuery: ''
    };
  }

  const { fixtureSelectionSet, errors } = traverseSelections(
    queryOperation.selectionSet.selections,
    fixtureData,
    fragments,
    schema,
    '',
    queryType
  );

  // Build query with variable definitions if present
  let generatedQuery = 'query';
  if (queryOperation.variableDefinitions && queryOperation.variableDefinitions.length > 0) {
    const varDefs = queryOperation.variableDefinitions.map(varDef => {
      const varName = varDef.variable.name.value;
      const varType = print(varDef.type);
      return `$${varName}: ${varType}`;
    }).join(', ');
    generatedQuery += `(${varDefs})`;
  }
  generatedQuery += ` { ${fixtureSelectionSet} }`;

  return {
    valid: errors.length === 0,
    errors,
    generatedQuery
  };
}

/**
 * Recursively extract fields from inline fragments
 * When the same field appears multiple times, merge their selection sets
 * @param selections - The selection set to extract fields from
 * @returns Map of field keys to arrays of field nodes (to handle field merging)
 */
function extractFieldsFromSelections(
  selections: readonly SelectionNode[]
): Map<string, FieldNode[]> {
  const selectedFields = new Map<string, FieldNode[]>();

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      const key = field.alias?.value || field.name.value;

      if (!selectedFields.has(key)) {
        selectedFields.set(key, []);
      }
      selectedFields.get(key)!.push(field);
    } else if (selection.kind === 'InlineFragment') {
      const fragment = selection as InlineFragmentNode;
      // Recursively extract fields from nested inline fragments
      const nestedFields = extractFieldsFromSelections(fragment.selectionSet.selections);
      for (const [key, fields] of nestedFields) {
        if (!selectedFields.has(key)) {
          selectedFields.set(key, []);
        }
        selectedFields.get(key)!.push(...fields);
      }
    }
  }

  return selectedFields;
}

/**
 * Build field string with arguments
 */
function buildFieldString(fieldNode: FieldNode, selectionSet: string): string {
  const fieldName = fieldNode.name.value;
  const alias = fieldNode.alias?.value;

  // Build field part with optional alias
  const fieldPart = alias ? `${alias}: ${fieldName}` : fieldName;

  // Build arguments string
  let argsString = '';
  if (fieldNode.arguments && fieldNode.arguments.length > 0) {
    const args = fieldNode.arguments.map(arg => {
      const argName = arg.name.value;
      const argValue = print(arg.value);
      return `${argName}: ${argValue}`;
    });
    argsString = `(${args.join(', ')})`;
  }

  // Build final field string
  if (selectionSet) {
    return `${fieldPart}${argsString} { ${selectionSet} }`;
  } else if (fieldNode.selectionSet) {
    // Field has selection set in query but no data was traversed (e.g., null value)
    // We still need to include the selection set for schema validation
    const querySelectionSet = buildSelectionSetString(fieldNode.selectionSet.selections);
    return `${fieldPart}${argsString} { ${querySelectionSet} }`;
  } else {
    return `${fieldPart}${argsString}`;
  }
}

/**
 * Build selection set string from selections without fixture data
 * Used for empty arrays where we have no fixture data to validate against
 */
function buildSelectionSetString(selections: readonly SelectionNode[]): string {
  const selectionParts: string[] = [];

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      const nestedSelectionSet = field.selectionSet
        ? buildSelectionSetString(field.selectionSet.selections)
        : '';
      selectionParts.push(buildFieldString(field, nestedSelectionSet));
    } else if (selection.kind === 'InlineFragment') {
      const fragment = selection as InlineFragmentNode;
      const fragmentFields = buildSelectionSetString(fragment.selectionSet.selections);
      const typeName = fragment.typeCondition?.name.value || '';
      selectionParts.push(`... on ${typeName} { ${fragmentFields} }`);
    }
  }

  return selectionParts.join(' ');
}

/**
 * Find which inline fragment matches the fixture data based on field names
 * @param inlineFragments - The inline fragments to check
 * @param fixtureKeys - The keys present in the fixture data
 * @returns The matching fragment, or null if no match found
 */
function findMatchingFragment(
  inlineFragments: readonly InlineFragmentNode[],
  fixtureKeys: string[]
): InlineFragmentNode | null {
  for (const fragment of inlineFragments) {
    const fragmentFields = new Set<string>();
    for (const selection of fragment.selectionSet.selections) {
      if (selection.kind === 'Field') {
        const field = selection as FieldNode;
        const key = field.alias?.value || field.name.value;
        fragmentFields.add(key);
      }
    }

    if (fixtureKeys.every(key => fragmentFields.has(key))) {
      return fragment;
    }
  }

  return null;
}

/**
 * Result of traversing selections at a level
 */
interface TraverseResult {
  fixtureSelectionSet: string;
  errors: string[];
}

/**
 * Convert fragment spreads to inline fragments by looking up their definitions
 * @param selections - The selections that may contain fragment spreads
 * @param fragments - Map of fragment definitions
 * @returns Array of inline fragments (includes both original inline fragments and converted spreads)
 */
function convertFragmentSpreadsToInline(
  selections: readonly SelectionNode[],
  fragments: Map<string, FragmentDefinitionNode>
): InlineFragmentNode[] {
  const inlineFragments: InlineFragmentNode[] = [];

  for (const selection of selections) {
    if (selection.kind === 'InlineFragment') {
      inlineFragments.push(selection as InlineFragmentNode);
    } else if (selection.kind === 'FragmentSpread') {
      const fragmentSpread = selection as FragmentSpreadNode;
      const fragmentName = fragmentSpread.name.value;
      const fragmentDef = fragments.get(fragmentName);
      if (fragmentDef) {
        inlineFragments.push({
          kind: 'InlineFragment',
          typeCondition: fragmentDef.typeCondition,
          selectionSet: fragmentDef.selectionSet
        } as InlineFragmentNode);
      }
    }
  }

  return inlineFragments;
}

/**
 * Traverse query selections and fixture data together
 *
 * @param selections - The selection set from the query
 * @param fixtureData - The fixture data at this level
 * @param fragments - Map of fragment definitions
 * @param schema - The GraphQL schema for type lookups
 * @param path - Current path for error messages (defaults to empty string at root)
 * @param parentType - The GraphQL type of the parent object (used to determine field return types)
 * @returns Selection set string and validation errors
 */
function traverseSelections(
  selections: readonly SelectionNode[],
  fixtureData: any,
  fragments: Map<string, FragmentDefinitionNode>,
  schema: GraphQLSchema,
  path: string = '',
  parentType?: GraphQLObjectType
): TraverseResult {
  if (fixtureData === null || fixtureData === undefined) {
    return { fixtureSelectionSet: '', errors: [] };
  }

  const errors: string[] = [];

  // Check if we're on an abstract type (union/interface) using the schema
  const isAbstractParentType = parentType && isAbstractType(parentType);

  // Handle arrays: process each item recursively
  if (Array.isArray(fixtureData)) {
    let fixtureSelectionSet = '';

    // Traverse each array item
    for (const [index, item] of fixtureData.entries()) {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      if (item !== null && item !== undefined) {
        const result = traverseSelections(selections, item, fragments, schema, itemPath, parentType);
        errors.push(...result.errors);

        // For regular types, capture selection set from first non-null object item
        if (!isAbstractParentType && !fixtureSelectionSet && typeof item === 'object') {
          fixtureSelectionSet = result.fixtureSelectionSet;
        }
      }
    }

    // Build the selection set for the array
    if (isAbstractParentType) {
      // For abstract types, generate all possible fragment types (not just first item's type)
      const inlineFragments = convertFragmentSpreadsToInline(selections, fragments);
      fixtureSelectionSet = buildSelectionSetString(inlineFragments);
    } else if (!fixtureSelectionSet) {
      // For regular types with empty array or no objects, build from query selections
      fixtureSelectionSet = buildSelectionSetString(selections);
    }

    return { fixtureSelectionSet, errors };
  } else {
    // Handle non-array data (objects and scalars)

    // Separate other selections (non-fragment selections)
    const otherSelections: SelectionNode[] = [];
    for (const selection of selections) {
      if (selection.kind !== 'InlineFragment' && selection.kind !== 'FragmentSpread') {
        otherSelections.push(selection);
      }
    }

    // Convert fragment spreads to inline fragments
    const inlineFragments = convertFragmentSpreadsToInline(selections, fragments);

    // If parent type is abstract AND we only have fragments (no other selections),
    // we need to match exactly ONE fragment
    if (isAbstractParentType && inlineFragments.length > 0 && otherSelections.length === 0) {
      return traverseInlineFragmentsForObject(
        inlineFragments,
        fixtureData,
        fragments,
        schema,
        path
      );
    } else {
      // Otherwise, merge everything: expand all fragments into the selection set
      const allSelections: SelectionNode[] = [...otherSelections];

      // Merge inline fragment selections
      for (const inlineFrag of inlineFragments) {
        allSelections.push(...inlineFrag.selectionSet.selections);
      }

      // Build a map of selected fields from the merged selections
      const selectedFields = extractFieldsFromSelections(allSelections);

      // Handle objects
      if (typeof fixtureData === 'object') {
        const selectionParts: string[] = [];

        // Check that every field in fixture is selected in query
        for (const fixtureKey of Object.keys(fixtureData)) {
          if (!selectedFields.has(fixtureKey)) {
            const fieldPath = path ? `${path}.${fixtureKey}` : fixtureKey;
            errors.push(`Fixture has field "${fixtureKey}" at path "${fieldPath}" but it is not selected in the query`);
          }
        }

        // Process each selected field
        for (const [aliasOrFieldName, fieldNodes] of selectedFields.entries()) {
          const fieldPath = path ? `${path}.${aliasOrFieldName}` : aliasOrFieldName;

          // Check if field exists in fixture
          if (!(aliasOrFieldName in fixtureData)) {
            errors.push(`Query selects field "${aliasOrFieldName}" at path "${fieldPath}" but it is missing from the fixture`);
            continue;
          }

          // When the same field appears multiple times, merge their selection sets
          const mergedSelections: SelectionNode[] = [];
          let hasSelectionSet = false;

          for (const fieldNode of fieldNodes) {
            if (fieldNode.selectionSet) {
              hasSelectionSet = true;
              mergedSelections.push(...fieldNode.selectionSet.selections);
            }
          }

          // Determine the selection set for this field
          let nestedSelectionSet = '';

          if (hasSelectionSet) {
            // Field has nested selections - look up the field's return type
            let fieldType: GraphQLObjectType | undefined;
            if (parentType) {
              const fieldName = fieldNodes[0].name.value;
              const field = parentType.getFields()[fieldName];
              if (field) {
                const namedType = getNamedType(field.type);
                // Pass the type if it's an object or abstract type that has type resolution
                // We check for 'getFields' to ensure it's an object type OR abstract type
                if (namedType && ('getFields' in namedType || isAbstractType(namedType))) {
                  fieldType = namedType as GraphQLObjectType;
                }
              }
            }

            // Traverse with merged selections and the field's return type
            const result = traverseSelections(
              mergedSelections,
              fixtureData[aliasOrFieldName],
              fragments,
              schema,
              fieldPath,
              fieldType
            );

            errors.push(...result.errors);
            nestedSelectionSet = result.fixtureSelectionSet;
          }

          // Build selection string using the first field node (for alias/name/args)
          const fieldString = buildFieldString(fieldNodes[0], nestedSelectionSet);
          selectionParts.push(fieldString);
        }

        return {
          fixtureSelectionSet: selectionParts.join(' '),
          errors
        };
      }

      // Scalar value - but we have selections, which means structure mismatch
      if (allSelections.length > 0) {
        errors.push(`Expected object with fields at path "${path}" but got scalar value`);
      }
      return { fixtureSelectionSet: '', errors };
    }
  }
}

/**
 * Traverse inline fragments for a single object (union/interface types)
 * This matches the fixture data against exactly ONE fragment
 */
function traverseInlineFragmentsForObject(
  inlineFragments: readonly InlineFragmentNode[],
  fixtureData: any,
  fragmentDefs: Map<string, FragmentDefinitionNode>,
  schema: GraphQLSchema,
  path: string = ''
): TraverseResult {
  const errors: string[] = [];

  if (typeof fixtureData !== 'object' || fixtureData === null) {
    return { fixtureSelectionSet: '', errors };
  }

  // Get fixture fields
  const fixtureKeys = Object.keys(fixtureData);

  // Find matching fragment
  const matchedFragment = findMatchingFragment(inlineFragments, fixtureKeys);

  if (!matchedFragment) {
    errors.push(`Fixture data at path "${path}" with fields [${fixtureKeys.join(', ')}] does not match any inline fragment`);
    return { fixtureSelectionSet: '', errors };
  }

  // Traverse the matched fragment and wrap result in inline fragment syntax
  const typeName = matchedFragment.typeCondition?.name.value || '';

  // Look up the concrete type from the schema
  let concreteType: GraphQLObjectType | undefined;
  if (typeName) {
    const schemaType = schema.getType(typeName);
    if (schemaType && 'getFields' in schemaType) {
      concreteType = schemaType as GraphQLObjectType;
    }
  }

  const result = traverseSelections(
    matchedFragment.selectionSet.selections,
    fixtureData,
    fragmentDefs,
    schema,
    path,
    concreteType
  );

  errors.push(...result.errors);

  return {
    fixtureSelectionSet: `... on ${typeName} { ${result.fixtureSelectionSet} }`,
    errors
  };
}

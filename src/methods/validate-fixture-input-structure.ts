import { DocumentNode, FieldNode, SelectionNode, InlineFragmentNode, FragmentDefinitionNode, OperationDefinitionNode, print } from 'graphql';

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
 * 2. Generates a GraphQL query string from the structure (with aliases preserved)
 *
 * @param queryAST - The GraphQL query AST
 * @param fixtureData - The fixture data to validate
 * @returns Result containing validation status, errors, and generated query
 */
export function validateFixtureInputStructure(
  queryAST: DocumentNode,
  fixtureData: Record<string, any>
): ValidateFixtureInputStructureResult {
  // Find the query operation
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
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of queryAST.definitions) {
    if (definition.kind === 'FragmentDefinition') {
      fragments.set(definition.name.value, definition);
    }
  }

  // Start traversal
  const { fixtureSelectionSet, errors } = traverseSelections(
    queryOperation.selectionSet.selections,
    fixtureData,
    fragments
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
 * @param selections - The selection set to extract fields from
 * @returns Map of field keys to field nodes
 */
function extractFieldsFromSelections(
  selections: readonly SelectionNode[]
): Map<string, FieldNode> {
  const selectedFields = new Map<string, FieldNode>();

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      const key = field.alias?.value || field.name.value;
      selectedFields.set(key, field);
    } else if (selection.kind === 'InlineFragment') {
      const fragment = selection as InlineFragmentNode;
      // Recursively extract fields from nested inline fragments
      const nestedFields = extractFieldsFromSelections(fragment.selectionSet.selections);
      for (const [key, field] of nestedFields) {
        selectedFields.set(key, field);
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

    const allFieldsMatch = fixtureKeys.every(key => fragmentFields.has(key));
    if (allFieldsMatch) {
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
 * Traverse query selections and fixture data together
 *
 * @param selections - The selection set from the query
 * @param fixtureData - The fixture data at this level
 * @param fragments - Map of fragment definitions
 * @param path - Current path for error messages (defaults to empty string at root)
 * @returns Selection set string and validation errors
 */
function traverseSelections(
  selections: readonly SelectionNode[],
  fixtureData: any,
  fragments: Map<string, FragmentDefinitionNode>,
  path: string = ''
): TraverseResult {
  if (fixtureData === null || fixtureData === undefined) {
    return { fixtureSelectionSet: '', errors: [] };
  }

  const errors: string[] = [];

  // Expand selections: replace FragmentSpreads with their inline equivalent
  const expandedSelections: SelectionNode[] = [];
  for (const selection of selections) {
    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value;
      const fragmentDef = fragments.get(fragmentName);
      if (fragmentDef) {
        // Convert fragment spread to inline fragment
        expandedSelections.push({
          kind: 'InlineFragment',
          typeCondition: fragmentDef.typeCondition,
          selectionSet: fragmentDef.selectionSet
        } as InlineFragmentNode);
      }
    } else {
      expandedSelections.push(selection);
    }
  }

  // Check if all selections are inline fragments (union/interface type)
  const hasOnlyInlineFragments =
    expandedSelections.length > 0 &&
    expandedSelections.every(s => s.kind === 'InlineFragment');

  // When all selections are inline fragments, we have a union/interface type
  // that requires special handling to match fixture data to the correct fragment
  if (hasOnlyInlineFragments) {
    return traverseInlineFragments(
      expandedSelections as readonly InlineFragmentNode[],
      fixtureData,
      fragments,
      path
    );
  }

  // Build a map of selected fields
  const selectedFields = extractFieldsFromSelections(expandedSelections);

  // Handle arrays
  if (Array.isArray(fixtureData)) {
    // Validate each array item against the query selections
    let fixtureSelectionSet = '';
    fixtureData.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      if (item !== null && item !== undefined) {
        const result = traverseSelections(expandedSelections, item, fragments, itemPath);
        errors.push(...result.errors);

        // Use the first non-null item to build the selection set
        if (!fixtureSelectionSet && typeof item === 'object') {
          fixtureSelectionSet = result.fixtureSelectionSet;
        }
      }
    });

    // If array is empty or has no objects, build selection set from query selections only
    if (!fixtureSelectionSet) {
      fixtureSelectionSet = buildSelectionSetString(expandedSelections);
    }

    return { fixtureSelectionSet, errors };
  }

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
    for (const [aliasOrFieldName, fieldNode] of selectedFields.entries()) {
      const fieldPath = path ? `${path}.${aliasOrFieldName}` : aliasOrFieldName;

      // Check if field exists in fixture
      if (!(aliasOrFieldName in fixtureData)) {
        errors.push(`Query selects field "${aliasOrFieldName}" at path "${fieldPath}" but it is missing from the fixture`);
        continue;
      }

      if (fieldNode.selectionSet) {
        // Field has nested selections
        const result = traverseSelections(
          fieldNode.selectionSet.selections,
          fixtureData[aliasOrFieldName],
          fragments,
          fieldPath
        );

        errors.push(...result.errors);

        // Build selection string with arguments if present
        const fieldString = buildFieldString(fieldNode, result.fixtureSelectionSet);
        selectionParts.push(fieldString);
      } else {
        // Scalar field
        const fieldString = buildFieldString(fieldNode, '');
        selectionParts.push(fieldString);
      }
    }

    return {
      fixtureSelectionSet: selectionParts.join(' '),
      errors
    };
  }

  // Scalar value - but we have selections, which means structure mismatch
  if (expandedSelections.length > 0) {
    errors.push(`Expected object with fields at path "${path}" but got scalar value`);
  }
  return { fixtureSelectionSet: '', errors };
}

/**
 * Traverse inline fragments (for union/interface types)
 */
function traverseInlineFragments(
  inlineFragments: readonly InlineFragmentNode[],
  fixtureData: any,
  fragmentDefs: Map<string, FragmentDefinitionNode>,
  path: string = ''
): TraverseResult {
  const errors: string[] = [];

  // Handle arrays
  if (Array.isArray(fixtureData)) {
    // Validate each array item against the inline fragments
    fixtureData.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      if (item !== null && item !== undefined) {
        const result = traverseInlineFragments(inlineFragments, item, fragmentDefs, itemPath);
        errors.push(...result.errors);
      }
    });

    // Build selection set with all fragments
    const fragmentSelections = inlineFragments.map(fragment => {
      const fragmentFields = buildSelectionSetString(fragment.selectionSet.selections);
      return `... on ${fragment.typeCondition?.name.value} { ${fragmentFields} }`;
    }).join(' ');

    return {
      fixtureSelectionSet: fragmentSelections,
      errors
    };
  }

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
  const result = traverseSelections(matchedFragment.selectionSet.selections, fixtureData, fragmentDefs, path);
  const typeName = matchedFragment.typeCondition?.name.value || '';

  errors.push(...result.errors);

  return {
    fixtureSelectionSet: `... on ${typeName} { ${result.fixtureSelectionSet} }`,
    errors
  };
}

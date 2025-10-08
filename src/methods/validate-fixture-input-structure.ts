import { DocumentNode, FieldNode, SelectionNode, InlineFragmentNode, FragmentSpreadNode, FragmentDefinitionNode } from 'graphql';

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
  const errors: string[] = [];

  // Find the query operation
  const queryOperation = queryAST.definitions.find(
    def => def.kind === 'OperationDefinition' && def.operation === 'query'
  );

  if (!queryOperation || queryOperation.kind !== 'OperationDefinition') {
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
  const { normalizedData, selectionSet } = traverseSelections(
    queryOperation.selectionSet.selections,
    fixtureData,
    '',
    errors,
    fragments
  );

  // Build query with variable definitions if present
  let generatedQuery = 'query';
  if (queryOperation.variableDefinitions && queryOperation.variableDefinitions.length > 0) {
    const varDefs = queryOperation.variableDefinitions.map(varDef => {
      const varName = varDef.variable.name.value;
      const varType = printType(varDef.type);
      return `$${varName}: ${varType}`;
    }).join(', ');
    generatedQuery += `(${varDefs})`;
  }
  generatedQuery += ` { ${selectionSet} }`;

  return {
    valid: errors.length === 0,
    errors,
    generatedQuery
  };
}

/**
 * Result of traversing selections at a level
 */
interface TraverseResult {
  normalizedData: any;
  selectionSet: string;
}

/**
 * Print a GraphQL type node as a string
 */
function printType(type: any): string {
  if (type.kind === 'NonNullType') {
    return `${printType(type.type)}!`;
  } else if (type.kind === 'ListType') {
    return `[${printType(type.type)}]`;
  } else if (type.kind === 'NamedType') {
    return type.name.value;
  }
  return '';
}

/**
 * Traverse query selections and fixture data together
 *
 * @param selections - The selection set from the query
 * @param fixtureData - The fixture data at this level
 * @param path - Current path for error messages
 * @param errors - Array to accumulate errors
 * @param fragments - Map of fragment definitions
 * @returns Normalized data and selection set string
 */
function traverseSelections(
  selections: readonly SelectionNode[],
  fixtureData: any,
  path: string,
  errors: string[],
  fragments: Map<string, FragmentDefinitionNode>
): TraverseResult {
  if (fixtureData === null || fixtureData === undefined) {
    return { normalizedData: fixtureData, selectionSet: '' };
  }

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
  const hasOnlyInlineFragments = expandedSelections.every(s => s.kind === 'InlineFragment');

  if (hasOnlyInlineFragments && expandedSelections.length > 0) {
    return traverseInlineFragments(
      expandedSelections as readonly InlineFragmentNode[],
      fixtureData,
      path,
      errors,
      fragments
    );
  }

  // Build a map of selected fields
  const selectedFields = new Map<string, FieldNode>();

  for (const selection of expandedSelections) {
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      const key = field.alias?.value || field.name.value;
      selectedFields.set(key, field);
    } else if (selection.kind === 'InlineFragment') {
      // For inline fragments mixed with regular fields, add all fields
      const fragment = selection as InlineFragmentNode;
      for (const fragmentSelection of fragment.selectionSet.selections) {
        if (fragmentSelection.kind === 'Field') {
          const field = fragmentSelection as FieldNode;
          const key = field.alias?.value || field.name.value;
          selectedFields.set(key, field);
        }
      }
    }
  }

  // Handle arrays
  if (Array.isArray(fixtureData)) {
    const normalizedArray: any[] = [];

    fixtureData.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      if (item !== null && item !== undefined) {
        const result = traverseSelections(expandedSelections, item, itemPath, errors, fragments);
        normalizedArray.push(result.normalizedData);
      } else {
        normalizedArray.push(item);
      }
    });

    // Build selection set from selections (not from fixture data)
    // For empty arrays, we still need to know what fields would be selected
    let selectionSet = '';
    const firstItem = fixtureData.find(item => item !== null && item !== undefined);
    if (firstItem && typeof firstItem === 'object') {
      // If we have data, use it to build the selection set (validates fixture matches query)
      const result = traverseSelections(expandedSelections, firstItem, path, [], fragments);
      selectionSet = result.selectionSet;
    } else {
      // If array is empty, build selection set from query selections only
      selectionSet = buildSelectionSetFromQuery(expandedSelections);
    }

    return { normalizedData: normalizedArray, selectionSet };
  }

  // Handle objects
  if (typeof fixtureData === 'object') {
    const normalized: Record<string, any> = {};
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
      const actualFieldName = fieldNode.name.value;
      const fixtureValue = fixtureData[aliasOrFieldName];

      // Check if field exists in fixture
      if (!(aliasOrFieldName in fixtureData)) {
        errors.push(`Query selects field "${aliasOrFieldName}" at path "${fieldPath}" but it is missing from the fixture`);
        continue;
      }

      // Normalize to actual field name so GraphQL execution can resolve it from rootValue
      // GraphQL looks up actual field names, not aliases, when resolving from rootValue
      const normalizedKey = actualFieldName;

      if (fieldNode.selectionSet) {
        // Field has nested selections
        const result = traverseSelections(
          fieldNode.selectionSet.selections,
          fixtureValue,
          fieldPath,
          errors,
          fragments
        );
        normalized[normalizedKey] = result.normalizedData;

        // Build selection string with arguments if present
        const fieldString = buildFieldString(fieldNode, result.selectionSet);
        selectionParts.push(fieldString);
      } else {
        // Scalar field
        normalized[normalizedKey] = fixtureValue;
        const fieldString = buildFieldString(fieldNode, '');
        selectionParts.push(fieldString);
      }
    }

    return {
      normalizedData: normalized,
      selectionSet: selectionParts.join(' ')
    };
  }

  // Scalar value
  return { normalizedData: fixtureData, selectionSet: '' };
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
      const argValue = valueToString(arg.value);
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
    const querySelectionSet = buildSelectionSetFromQuery(fieldNode.selectionSet.selections);
    return `${fieldPart}${argsString} { ${querySelectionSet} }`;
  } else {
    return `${fieldPart}${argsString}`;
  }
}

/**
 * Convert GraphQL value node to string representation
 */
function valueToString(value: any): string {
  switch (value.kind) {
    case 'IntValue':
    case 'FloatValue':
    case 'BooleanValue':
      return value.value;
    case 'StringValue':
      return `"${value.value}"`;
    case 'EnumValue':
      return value.value;
    case 'NullValue':
      return 'null';
    case 'Variable':
      return `$${value.name.value}`;
    case 'ListValue':
      return `[${value.values.map(valueToString).join(', ')}]`;
    case 'ObjectValue':
      const fields = value.fields.map((f: any) => `${f.name.value}: ${valueToString(f.value)}`);
      return `{${fields.join(', ')}}`;
    default:
      return '';
  }
}

/**
 * Build selection set string from query selections without fixture data
 * Used for empty arrays where we have no fixture data to validate against
 */
function buildSelectionSetFromQuery(selections: readonly SelectionNode[]): string {
  const selectionParts: string[] = [];

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      const field = selection as FieldNode;
      const nestedSelectionSet = field.selectionSet
        ? buildSelectionSetFromQuery(field.selectionSet.selections)
        : '';
      selectionParts.push(buildFieldString(field, nestedSelectionSet));
    } else if (selection.kind === 'InlineFragment') {
      const fragment = selection as InlineFragmentNode;
      const fragmentFields = buildSelectionSetFromQuery(fragment.selectionSet.selections);
      const typeName = fragment.typeCondition?.name.value || '';
      selectionParts.push(`... on ${typeName} { ${fragmentFields} }`);
    }
  }

  return selectionParts.join(' ');
}

/**
 * Traverse inline fragments (for union/interface types)
 */
function traverseInlineFragments(
  inlineFragments: readonly InlineFragmentNode[],
  fixtureData: any,
  path: string,
  errors: string[],
  fragmentDefs: Map<string, FragmentDefinitionNode>
): TraverseResult {
  // Handle arrays
  if (Array.isArray(fixtureData)) {
    const normalizedArray: any[] = [];

    fixtureData.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      if (item !== null && item !== undefined) {
        const result = traverseInlineFragments(inlineFragments, item, itemPath, errors, fragmentDefs);
        normalizedArray.push(result.normalizedData);
      } else {
        normalizedArray.push(item);
      }
    });

    // Build selection set with all fragments
    const fragmentSelections = inlineFragments.map(fragment => {
      const fragmentFields = buildSelectionSetFromQuery(fragment.selectionSet.selections);
      return `... on ${fragment.typeCondition?.name.value} { ${fragmentFields} }`;
    }).join(' ');

    return {
      normalizedData: normalizedArray,
      selectionSet: fragmentSelections
    };
  }

  if (typeof fixtureData !== 'object' || fixtureData === null) {
    return { normalizedData: fixtureData, selectionSet: '' };
  }

  // Get fixture fields
  const fixtureKeys = Object.keys(fixtureData);

  // Find matching fragment
  let matchedFragment: InlineFragmentNode | null = null;

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
      matchedFragment = fragment;
      break;
    }
  }

  if (!matchedFragment) {
    errors.push(`Fixture data at path "${path}" with fields [${fixtureKeys.join(', ')}] does not match any inline fragment`);
    return { normalizedData: fixtureData, selectionSet: '' };
  }

  // Traverse the matched fragment and wrap result in inline fragment syntax
  const result = traverseSelections(matchedFragment.selectionSet.selections, fixtureData, path, errors, fragmentDefs);
  const typeName = matchedFragment.typeCondition?.name.value || '';

  // Add __typename to help GraphQL resolve the concrete type
  const normalizedWithTypename = {
    __typename: typeName,
    ...result.normalizedData
  };

  return {
    normalizedData: normalizedWithTypename,
    selectionSet: `... on ${typeName} { ${result.selectionSet} }`
  };
}

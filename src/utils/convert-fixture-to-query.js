/**
 * Convert fixture data structure to a GraphQL query string
 * 
 * This function takes fixture data (objects, arrays, scalars) and generates
 * a GraphQL query that selects all the fields present in the fixture.
 * This is useful for validating fixture data against GraphQL schemas by 
 * executing the generated query with the fixture as root value.
 * 
 * @param {Object} fixtureData - The fixture data to convert
 * @param {string} fieldName - The root field name (e.g., 'input', 'output', 'data') 
 * @returns {string} GraphQL query string that matches the fixture structure
 */
export function convertFixtureToQuery(fixtureData, fieldName = 'data') {
  function buildSelectionSet(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return '';
    }

    const selections = Object.keys(obj).map(key => {
      const value = obj[key];
      
      if (Array.isArray(value)) {
        // For arrays, use the first element to determine structure
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          const nestedSelection = buildSelectionSet(value[0]);
          return nestedSelection ? `${key} { ${nestedSelection} }` : key;
        } else {
          return key;
        }
      } else if (typeof value === 'object' && value !== null) {
        const nestedSelection = buildSelectionSet(value);
        return nestedSelection ? `${key} { ${nestedSelection} }` : key;
      } else {
        return key;
      }
    });

    return selections.join(' ');
  }

  const selectionSet = buildSelectionSet(fixtureData);
  
  // If no fieldName provided (empty string), generate query without wrapper
  if (fieldName === '') {
    return `query { ${selectionSet} }`;
  }
  
  return `query { ${fieldName} { ${selectionSet} } }`;
}


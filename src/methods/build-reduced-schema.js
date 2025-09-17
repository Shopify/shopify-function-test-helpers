const { GraphQLSchema } = require('graphql');

/**
 * Build a reduced GraphQL schema containing only the target type and its dependencies
 * @param {string} targetTypeName - The GraphQL type name to extract
 * @param {Object} originalSchema - The original GraphQL schema
 * @returns {GraphQLSchema} The reduced schema containing only the target type and its dependencies
 * @throws {Error} If the target type is not found in the schema
 */
function buildReducedSchema(targetTypeName, originalSchema) {
  // Get the target type from the original schema
  const targetType = originalSchema.getType(targetTypeName);
  if (!targetType) {
    throw new Error(`Type '${targetTypeName}' not found in schema`);
  }

  // Extract all types used by the target type recursively
  const requiredTypes = new Set();
  
  function collectRequiredTypes(type) {
    if (!type || !type.name || requiredTypes.has(type.name) || type.name.startsWith('__')) {
      return;
    }
    
    requiredTypes.add(type.name);
    
    // Handle object types with fields
    if (type.getFields) {
      const fields = type.getFields();
      Object.values(fields).forEach(field => {
        let fieldType = field.type;
        
        // Unwrap NonNull and List wrappers
        while (fieldType.ofType) {
          fieldType = fieldType.ofType;
        }
        
        collectRequiredTypes(fieldType);
      });
    }
    
    // Handle union types
    if (type.getTypes) {
      type.getTypes().forEach(collectRequiredTypes);
    }
  }
  
  collectRequiredTypes(targetType);
  
  // Build a reduced schema programmatically using the type objects
  const typeMap = originalSchema.getTypeMap();
  const reducedTypeMap = {};
  
  // Copy only the required types to the reduced schema
  requiredTypes.forEach(typeName => {
    const type = typeMap[typeName];
    if (type && !typeName.startsWith('__')) {
      reducedTypeMap[typeName] = type;
    }
  });
  
  // Create a new schema with only the required types
  return new GraphQLSchema({
    types: Object.values(reducedTypeMap),
  });
}

module.exports = buildReducedSchema;
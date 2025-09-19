const { 
  GraphQLObjectType, 
  GraphQLList,
  GraphQLNonNull,
  isInputType
} = require('graphql');

/**
 * Convert an input type to an equivalent output type structure
 * 
 * This function is essential for output fixture validation because:
 * 1. Function outputs match input type structure (like CartValidationsGenerateRunResult)
 * 2. But input types cannot be used in Query fields - GraphQL requires output types
 * 3. This converts input types → equivalent output types with resolvers
 * 4. Enables GraphQL execution for native type validation
 * 
 * @param {GraphQLInputType} inputType - The input type to convert
 * @param {Map} conversionCache - Cache to avoid infinite recursion
 * @returns {GraphQLOutputType} The equivalent output type
 */
function convertInputTypeToOutputType(inputType, conversionCache = new Map()) {
  // Handle wrappers (NonNull, List)
  if (inputType.constructor.name === 'GraphQLNonNull') {
    return new GraphQLNonNull(convertInputTypeToOutputType(inputType.ofType, conversionCache));
  }
  
  if (inputType.constructor.name === 'GraphQLList') {
    return new GraphQLList(convertInputTypeToOutputType(inputType.ofType, conversionCache));
  }

  // Handle scalars - they're the same for input and output
  if (inputType.constructor.name.includes('Scalar') || 
      ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(inputType.name)) {
    return inputType;
  }

  // Check cache to avoid infinite recursion
  if (conversionCache.has(inputType.name)) {
    return conversionCache.get(inputType.name);
  }

  // Convert input object type to output object type
  if (inputType.constructor.name === 'GraphQLInputObjectType') {
    const outputType = new GraphQLObjectType({
      name: `${inputType.name}Output`,
      description: inputType.description,
      fields: () => {
        const outputFields = {};
        const inputFields = inputType.getFields();
        
        Object.keys(inputFields).forEach(fieldName => {
          const inputField = inputFields[fieldName];
          outputFields[fieldName] = {
            type: convertInputTypeToOutputType(inputField.type, conversionCache),
            description: inputField.description,
            resolve: (parent) => parent ? parent[fieldName] : null
          };
        });
        
        return outputFields;
      }
    });
    
    conversionCache.set(inputType.name, outputType);
    return outputType;
  }

  // If it's already an output type, return as-is
  return inputType;
}

module.exports = {
  convertInputTypeToOutputType
};
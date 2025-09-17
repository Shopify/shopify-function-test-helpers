/**
 * Validate a fixture to ensure it has the correct structure
 * @param {Object} fixture - The fixture data to validate
 * @returns {Object} Validation result with success status and any errors
 */
function validateFixture(fixture) {
  const errors = [];
  
  // Check required top-level properties
  if (!fixture.shopId) {
    errors.push("Missing shopId in fixture");
  }
  
  if (!fixture.payload) {
    errors.push("Missing payload in fixture");
    return {
      isValid: false,
      errors
    };
  }
  
  if (!fixture.payload.export) {
    errors.push("Missing export in fixture payload");
  }
  
  if (!fixture.payload.input) {
    errors.push("Missing input in fixture payload");
  }
  
  if (!fixture.payload.output) {
    errors.push("Missing output in fixture payload");
  }
  
  if (!Array.isArray(fixture.payload.output.operations)) {
    errors.push("Output operations should be an array");
  }
  
  if (!fixture.status) {
    errors.push("Missing status in fixture");
  }
  
  if (!fixture.source) {
    errors.push("Missing source in fixture");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateFixture;
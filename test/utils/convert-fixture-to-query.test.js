const { convertFixtureToQuery } = require('../../src/utils/convert-fixture-to-query');

describe('convertFixtureToQuery', () => {

  describe('Basic Structure Conversion', () => {
    it('should convert simple object to query', () => {
      const fixture = {
        message: "Hello",
        count: 42
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      expect(query).toBe('query { data { message count } }');
    });

    it('should handle nested objects', () => {
      const fixture = {
        cart: {
          lines: [{
            quantity: 1,
            merchandise: {
              id: "123",
              title: "Product"
            }
          }],
          buyerIdentity: {
            email: "test@example.com"
          }
        }
      };

      const query = convertFixtureToQuery(fixture, 'input');
      
      expect(query).toContain('query { input {');
      expect(query).toContain('cart {');
      expect(query).toContain('lines {');
      expect(query).toContain('quantity merchandise');
      expect(query).toContain('buyerIdentity {');
      expect(query).toContain('email');
    });
  });

  describe('Array Handling', () => {
    it('should handle arrays with objects', () => {
      const fixture = {
        operations: [{
          addValidation: {
            errors: [{
              message: "Error message",
              target: "$.cart"
            }]
          }
        }]
      };

      const query = convertFixtureToQuery(fixture, 'output');
      
      expect(query).toContain('operations {');
      expect(query).toContain('addValidation {');
      expect(query).toContain('errors {');
      expect(query).toContain('message target');
    });

    it('should handle empty arrays', () => {
      const fixture = {
        operations: []
      };

      const query = convertFixtureToQuery(fixture, 'output');
      
      expect(query).toBe('query { output { operations } }');
    });

    it('should handle arrays with scalar values', () => {
      const fixture = {
        tags: ["tag1", "tag2", "tag3"]
      };

      const query = convertFixtureToQuery(fixture, 'data');
      
      expect(query).toBe('query { data { tags } }');
    });
  });

  describe('Field Name Variations', () => {
    it('should handle different field names', () => {
      const fixture = { test: "value" };
      
      const queryWithData = convertFixtureToQuery(fixture, 'data');
      const queryWithInput = convertFixtureToQuery(fixture, 'input');
      const queryWithOutput = convertFixtureToQuery(fixture, 'output');
      
      expect(queryWithData).toBe('query { data { test } }');
      expect(queryWithInput).toBe('query { input { test } }');
      expect(queryWithOutput).toBe('query { output { test } }');
    });

    it('should handle empty field name', () => {
      const fixture = {
        cart: {
          lines: [{ quantity: 1 }]
        }
      };
      
      const query = convertFixtureToQuery(fixture, '');
      
      expect(query).toBe('query { cart { lines { quantity } } }');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const fixture = {
        value: null,
        other: "test"
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      // For mutation-based validation, we want to include all fields (including null)
      // so GraphQL can validate the complete structure
      expect(query).toBe('query { data { value other } }');
      expect(query).toContain('value');
      expect(query).toContain('other');
    });

    it('should handle mixed data types', () => {
      const fixture = {
        string: "text",
        number: 123,
        boolean: true,
        object: {
          nested: "value"
        },
        array: [{ item: "test" }]
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      expect(query).toContain('string number boolean');
      expect(query).toContain('object { nested }');
      expect(query).toContain('array { item }');
    });

    it('should handle deeply nested structures', () => {
      const fixture = {
        level1: {
          level2: {
            level3: {
              level4: {
                deepValue: "found"
              }
            }
          }
        }
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      expect(query).toBe('query { data { level1 { level2 { level3 { level4 { deepValue } } } } } }');
    });

    it('should handle empty objects', () => {
      const fixture = {
        emptyObject: {},
        normalField: "value"
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      // For mutation-based validation, we include empty objects in the query structure
      // GraphQL will handle validation of whether empty objects are allowed
      expect(query).toBe('query { data { emptyObject normalField } }');
      expect(query).toContain('emptyObject');
      expect(query).toContain('normalField');
    });
  });
});
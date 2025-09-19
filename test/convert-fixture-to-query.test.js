const { convertFixtureToQuery } = require('../src/methods/convert-fixture-to-query');

describe('convertFixtureToQuery', () => {

  describe('Basic Structure Conversion', () => {
    it('should convert simple object to query', () => {
      const fixture = {
        message: "Hello",
        count: 42
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      console.log('\\n=== SIMPLE OBJECT CONVERSION ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
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
      
      console.log('\\n=== NESTED OBJECTS CONVERSION ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
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
          validationAdd: {
            errors: [{
              message: "Error message",
              target: "$.cart"
            }]
          }
        }]
      };

      const query = convertFixtureToQuery(fixture, 'output');
      
      console.log('\\n=== ARRAY WITH OBJECTS CONVERSION ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toContain('operations {');
      expect(query).toContain('validationAdd {');
      expect(query).toContain('errors {');
      expect(query).toContain('message target');
    });

    it('should handle empty arrays', () => {
      const fixture = {
        operations: []
      };

      const query = convertFixtureToQuery(fixture, 'output');
      
      console.log('\\n=== EMPTY ARRAY CONVERSION ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toBe('query { output { operations } }');
    });

    it('should handle arrays with scalar values', () => {
      const fixture = {
        tags: ["tag1", "tag2", "tag3"]
      };

      const query = convertFixtureToQuery(fixture, 'data');
      
      console.log('\\n=== SCALAR ARRAY CONVERSION ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toBe('query { data { tags } }');
    });
  });

  describe('Field Name Variations', () => {
    it('should handle different field names', () => {
      const fixture = { test: "value" };
      
      const queryWithData = convertFixtureToQuery(fixture, 'data');
      const queryWithInput = convertFixtureToQuery(fixture, 'input');
      const queryWithOutput = convertFixtureToQuery(fixture, 'output');
      
      console.log('\\n=== FIELD NAME VARIATIONS ===');
      console.log('With "data":', queryWithData);
      console.log('With "input":', queryWithInput);
      console.log('With "output":', queryWithOutput);
      
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
      
      console.log('\\n=== EMPTY FIELD NAME ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
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
      
      console.log('\\n=== NULL VALUES ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toBe('query { data { other } }');
      expect(query).not.toContain('value');
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
      
      console.log('\\n=== MIXED DATA TYPES ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
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
      
      console.log('\\n=== DEEPLY NESTED STRUCTURES ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toBe('query { data { level1 { level2 { level3 { level4 { deepValue } } } } } }');
    });

    it('should handle empty objects', () => {
      const fixture = {
        emptyObject: {},
        normalField: "value"
      };
      
      const query = convertFixtureToQuery(fixture, 'data');
      
      console.log('\\n=== EMPTY OBJECTS ===');
      console.log('Input:', JSON.stringify(fixture, null, 2));
      console.log('Generated query:', query);
      
      expect(query).toBe('query { data { normalField } }');
      expect(query).not.toContain('emptyObject');
    });
  });
});
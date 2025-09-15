const {
  loadFixture,
  validateFixture,
  buildFunction,
  runFunction
} = require('../index.js');

describe('Shopify Functions WASM Testing Helpers', () => {
  describe('loadFixture', () => {
    it('should load fixture from a valid JSON file', () => {
      const fixture = loadFixture('20250915_184036_156Z_extensions_cart-checkout-validation_ba711d.json');
      
      expect(fixture).toBeDefined();
      expect(fixture.shopId).toBe(1234);
      expect(fixture.payload.export).toBe('cart_validations_generate_run');
      expect(fixture.payload.input.cart).toBeDefined();
    });

    it('should throw an error for non-existent file', () => {
      expect(() => {
        loadFixture('non-existent-file.json');
      }).toThrow('Fixture file not found: non-existent-file.json');
    });
  });

  describe('validateFixture', () => {
    it('should validate a correct fixture', () => {
      const fixture = loadFixture('20250915_184036_156Z_extensions_cart-checkout-validation_ba711d.json');
      
      const validation = validateFixture(fixture);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should identify missing shopId', () => {
      const invalidFixture = {
        payload: {
          export: 'cart_validations_generate_run',
          input: { cart: {} },
          output: { operations: [] }
        },
        status: 'success',
        source: 'cart-checkout-validation'
      };
      
      const validation = validateFixture(invalidFixture);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing shopId in fixture');
    });

    it('should identify missing payload', () => {
      const invalidFixture = {
        shopId: 1234,
        status: 'success',
        source: 'cart-checkout-validation'
      };
      
      const validation = validateFixture(invalidFixture);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing payload in fixture');
    });

    it('should identify missing export in payload', () => {
      const invalidFixture = {
        shopId: 1234,
        payload: {
          input: { cart: {} },
          output: { operations: [] }
        },
        status: 'success',
        source: 'cart-checkout-validation'
      };
      
      const validation = validateFixture(invalidFixture);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing export in fixture payload');
    });
  });

  describe('buildFunction', () => {
    it('should build a function payload with default cart', () => {
      const cart = {
        lines: [
          {
            quantity: 1,
            merchandise: {
              id: "gid://shopify/ProductVariant/123",
              title: "Test Product",
              price: {
                amount: "10.00",
                currencyCode: "USD"
              }
            }
          }
        ],
        buyerIdentity: {
          email: "test@example.com"
        }
      };
      
      const payload = buildFunction(cart);
      
      expect(payload).toBeDefined();
      expect(payload.shopId).toBe(1234);
      expect(payload.payload.export).toBe('cart_validations_generate_run');
      expect(payload.payload.input.cart).toEqual(cart);
      expect(payload.status).toBe('success');
      expect(payload.source).toBe('cart-checkout-validation');
    });

    it('should build a function payload with custom options', () => {
      const cart = {
        lines: [{ quantity: 1 }]
      };
      
      const customOptions = {
        shopId: 9999,
        status: 'pending',
        storeName: 'custom-shop.myshopify.com',
        functionId: 'custom-function-id'
      };
      
      const payload = buildFunction(cart, customOptions);
      
      expect(payload.shopId).toBe(9999);
      expect(payload.status).toBe('pending');
      expect(payload.storeName).toBe('custom-shop.myshopify.com');
      expect(payload.payload.functionId).toBe('custom-function-id');
    });
  });

  describe('runFunction', () => {
    it('should run a function successfully', () => {
      const cart = {
        lines: [{ quantity: 1 }]
      };
      
      const payload = buildFunction(cart);
      
      const mockFunction = (input) => ({
        operations: [
          {
            validationAdd: {
              errors: [
                {
                  message: 'Test validation error',
                  target: '$.cart'
                }
              ]
            }
          }
        ]
      });
      
      const result = runFunction(payload, mockFunction);
      
      expect(result.status).toBe('success');
      expect(result.payload.output.operations).toHaveLength(1);
      expect(result.payload.output.operations[0].validationAdd.errors[0].message).toBe('Test validation error');
    });

    it('should handle function errors', () => {
      const cart = {
        lines: [{ quantity: 1 }]
      };
      
      const payload = buildFunction(cart);
      
      const errorFunction = () => {
        throw new Error('Function execution failed');
      };
      
      const result = runFunction(payload, errorFunction);
      
      expect(result.status).toBe('error');
      expect(result.error).toBe('Function execution failed');
      expect(result.payload.logs).toContain('Function execution failed');
    });

    it('should throw error for non-function implementation', () => {
      const cart = {
        lines: [{ quantity: 1 }]
      };
      
      const payload = buildFunction(cart);
      
      expect(() => {
        runFunction(payload, 'not-a-function');
      }).toThrow('functionImplementation must be a function');
    });
  });
});

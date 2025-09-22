const { validateFixtureComplete } = require('../../src/methods/validate-fixture-complete');
const path = require('path');

describe('validateFixtureComplete', () => {
  describe('Cart Validation Function', () => {
    it('should perform complete validation workflow for cart validation function', async () => {
      // First, let's create a simple input query file for testing
      const fs = require('fs').promises;
      const testQueryPath = './test/temp-cart-validation-query.graphql';
      
      // Create a basic query that should work with the cart validation schema
      const testQuery = `
        query {
          cart {
            lines {
              quantity
            }
          }
        }
      `;
      
      await fs.writeFile(testQueryPath, testQuery);

      try {
        const result = await validateFixtureComplete({
          schemaPath: './test-app/extensions/cart-validation-js/schema.graphql',
          fixturePath: './test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json',
          inputQueryPath: testQueryPath,
          mutationName: 'cartValidationsGenerateRun',
          resultParameterName: 'result'
        });

        console.log('\n=== CART VALIDATION COMPLETE WORKFLOW ===');
        console.log('Schema path:', result.schemaPath);
        console.log('Fixture path:', result.fixturePath);
        console.log('Input query path:', result.inputQueryPath);
        console.log('Mutation name:', result.mutationName);
        console.log('');
        console.log('Input Query Validation:', result.inputQuery.valid ? '✅ VALID' : '❌ INVALID');
        console.log('Input Fixture Validation:', result.inputFixture.valid ? '✅ VALID' : '❌ INVALID');
        console.log('Output Fixture Validation:', result.outputFixture.valid ? '✅ VALID' : '❌ INVALID');
        console.log('');
        console.log('Summary:', result.overall.summary);

        if (!result.inputQuery.valid) {
          console.log('Input query errors:', result.inputQuery.errors.length);
        }
        if (!result.inputFixture.valid) {
          console.log('Input fixture errors:', result.inputFixture.errors.length);
        }
        if (!result.outputFixture.valid) {
          console.log('Output fixture errors:', result.outputFixture.errors.length);
        }

        // Validate result structure
        expect(result).toHaveProperty('schemaPath');
        expect(result).toHaveProperty('fixturePath');
        expect(result).toHaveProperty('inputQueryPath');
        expect(result).toHaveProperty('mutationName');
        expect(result).toHaveProperty('inputQuery');
        expect(result).toHaveProperty('inputFixture');
        expect(result).toHaveProperty('outputFixture');
        expect(result).toHaveProperty('overall');

        // Input query validation
        expect(result.inputQuery).toHaveProperty('valid');
        expect(result.inputQuery).toHaveProperty('errors');
        expect(Array.isArray(result.inputQuery.errors)).toBe(true);

        // Input fixture validation
        expect(result.inputFixture).toHaveProperty('valid');
        expect(result.inputFixture).toHaveProperty('errors');
        expect(Array.isArray(result.inputFixture.errors)).toBe(true);

        // Output fixture validation
        expect(result.outputFixture).toHaveProperty('valid');
        expect(result.outputFixture).toHaveProperty('errors');
        expect(result.outputFixture).toHaveProperty('query');
        expect(result.outputFixture).toHaveProperty('variables');
        expect(Array.isArray(result.outputFixture.errors)).toBe(true);

        // Overall validation
        expect(result.overall).toHaveProperty('valid');
        expect(result.overall).toHaveProperty('summary');
        expect(typeof result.overall.summary).toBe('string');

        // Clean up
        await fs.unlink(testQueryPath);

      } catch (error) {
        // Clean up even if test fails
        try {
          await fs.unlink(testQueryPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
        throw error;
      }
    });
  });

  describe('Discount Function', () => {
    it('should perform complete validation workflow for discount function', async () => {
      // Create a test input query file for discount function
      const fs = require('fs').promises;
      const testQueryPath = './test/temp-discount-query.graphql';
      
      const testQuery = `
        query {
          cart {
            lines {
              id
              cost {
                subtotalAmount {
                  amount
                }
              }
            }
          }
          discount {
            discountClasses
          }
        }
      `;
      
      await fs.writeFile(testQueryPath, testQuery);

      try {
        const result = await validateFixtureComplete({
          schemaPath: './test-app/extensions/discount-function/schema.graphql',
          fixturePath: './test-app/extensions/discount-function/tests/fixtures/20250922_155724_476Z_extensions_discount-function_631650.json',
          inputQueryPath: testQueryPath,
          mutationName: 'cartLinesDiscountsGenerateRun',
          resultParameterName: 'result'
        });

        console.log('\n=== DISCOUNT FUNCTION COMPLETE WORKFLOW ===');
        console.log('Schema path:', result.schemaPath);
        console.log('Fixture path:', path.basename(result.fixturePath));
        console.log('Input query path:', path.basename(result.inputQueryPath));
        console.log('Mutation name:', result.mutationName);
        console.log('');
        console.log('Input Query Validation:', result.inputQuery.valid ? '✅ VALID' : '❌ INVALID');
        console.log('Input Fixture Validation:', result.inputFixture.valid ? '✅ VALID' : '❌ INVALID');
        console.log('Output Fixture Validation:', result.outputFixture.valid ? '✅ VALID' : '❌ INVALID');
        console.log('');
        console.log('Summary:', result.overall.summary);

        // Validate discount-specific results
        expect(result.mutationName).toBe('cartLinesDiscountsGenerateRun');
        expect(result.inputQuery).toHaveProperty('valid');
        expect(result.inputQuery).toHaveProperty('errors');
        expect(result.inputFixture).toHaveProperty('valid');
        expect(result.outputFixture).toHaveProperty('valid');
        expect(result.overall).toHaveProperty('valid');

        // Clean up
        await fs.unlink(testQueryPath);

      } catch (error) {
        // Clean up even if test fails
        try {
          await fs.unlink(testQueryPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent schema file', async () => {
      const result = await validateFixtureComplete({
        schemaPath: './non-existent-schema.graphql',
        fixturePath: './test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json',
        inputQueryPath: './test/temp-input-query.graphql', // Will fail before this is checked
        mutationName: 'cartValidationsGenerateRun'
      });

      console.log('\n=== ERROR HANDLING - MISSING SCHEMA ===');
      console.log('Valid:', result.overall.valid);
      console.log('Summary:', result.overall.summary);

      expect(result.overall.valid).toBe(false);
      expect(result.overall.summary).toContain('Validation failed');
      expect(result.inputFixture.errors.length).toBeGreaterThan(0);
      expect(result.outputFixture.errors.length).toBeGreaterThan(0);
    });

    it('should handle non-existent fixture file', async () => {
      const result = await validateFixtureComplete({
        schemaPath: './test-app/extensions/cart-validation-js/schema.graphql',
        fixturePath: './non-existent-fixture.json',
        inputQueryPath: './test/temp-input-query.graphql', // Will fail before this is checked
        mutationName: 'cartValidationsGenerateRun'
      });

      console.log('\n=== ERROR HANDLING - MISSING FIXTURE ===');
      console.log('Valid:', result.overall.valid);
      console.log('Summary:', result.overall.summary);

      expect(result.overall.valid).toBe(false);
      expect(result.overall.summary).toContain('Validation failed');
    });

    it('should handle invalid mutation name', async () => {
      // Create a temporary query file for this test
      const fs = require('fs').promises;
      const testQueryPath = './test/temp-invalid-mutation-query.graphql';
      const testQuery = 'query { cart { lines { quantity } } }';
      await fs.writeFile(testQueryPath, testQuery);

      try {
        const result = await validateFixtureComplete({
          schemaPath: './test-app/extensions/cart-validation-js/schema.graphql',
          fixturePath: './test-app/extensions/cart-validation-js/tests/fixtures/cda6d1.json',
          inputQueryPath: testQueryPath,
          mutationName: 'nonExistentMutation'
        });

        console.log('\n=== ERROR HANDLING - INVALID MUTATION ===');
        console.log('Valid:', result.overall.valid);
        console.log('Summary:', result.overall.summary);
        console.log('Output fixture errors:', result.outputFixture.errors.length);

        expect(result.overall.valid).toBe(false);
        expect(result.outputFixture.valid).toBe(false);
        expect(result.outputFixture.errors.length).toBeGreaterThan(0);

        // Clean up
        await fs.unlink(testQueryPath);

      } catch (error) {
        // Clean up even if test fails
        try {
          await fs.unlink(testQueryPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
        throw error;
      }
    });
  });
});
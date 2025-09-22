const { validateOutputWithMutation } = require('../src/methods/validate-output-with-mutation');
const { validateInputFixtureWithOriginalSchema } = require('../src/methods/validate-input-fixture-original-schema');
const loadFixture = require('../src/methods/load-fixture');
const { buildSchema } = require('graphql');
const fs = require('fs').promises;

describe('Discount Function Extension Validation', () => {
  let discountSchema;
  let discountFixture;

  beforeAll(async () => {
    // Load the discount-function schema
    const schemaString = await fs.readFile('./test-app/extensions/discount-function/schema.graphql', 'utf8');
    discountSchema = buildSchema(schemaString);

    // Load the raw discount-function fixture (not using loadFixture helper since we want the full structure)
    const fixtureContent = await fs.readFile('./test-app/extensions/discount-function/tests/fixtures/20250922_155724_476Z_extensions_discount-function_631650.json', 'utf8');
    discountFixture = JSON.parse(fixtureContent);
  });

  describe('Input Validation', () => {
    it('should validate input fixture against discount function schema', async () => {
      const result = await validateInputFixtureWithOriginalSchema(
        discountFixture.payload.input,
        discountSchema
      );

      console.log('\\n=== DISCOUNT FUNCTION INPUT VALIDATION ===');
      console.log('Input data structure:');
      console.log('- Cart lines:', discountFixture.payload.input.cart.lines.length);
      console.log('- Discount classes:', discountFixture.payload.input.discount.discountClasses);
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors.length);
      if (result.errors.length > 0) {
        console.log('Error messages:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.message}`);
        });
      }

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Output Validation', () => {
    it('should validate output fixture against cartLinesDiscountsGenerateRun mutation', async () => {
      const outputData = discountFixture.payload.output;

      const result = await validateOutputWithMutation(
        outputData,
        discountSchema,
        'cartLinesDiscountsGenerateRun',
        'result'
      );

      console.log('\\n=== DISCOUNT FUNCTION OUTPUT VALIDATION ===');
      console.log('Output data structure:');
      console.log('- Operations count:', outputData.operations.length);
      console.log('- Operation types:');
      outputData.operations.forEach((op, index) => {
        const opType = Object.keys(op)[0];
        console.log(`  ${index + 1}. ${opType}`);
        if (op[opType].candidates) {
          console.log(`     - Candidates: ${op[opType].candidates.length}`);
        }
      });
      
      console.log('Mutation name:', result.mutationName);
      console.log('Result parameter type:', result.resultParameterType);
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors.length);
      if (result.errors.length > 0) {
        console.log('Error messages:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.message}`);
        });
      }

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('variables');
      expect(result.mutationName).toBe('cartLinesDiscountsGenerateRun');
      expect(result.resultParameterType).toBe('CartLinesDiscountsGenerateRunResult!');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should analyze specific discount operation types', async () => {
      const outputData = discountFixture.payload.output;
      
      // Extract specific operation details for validation
      const orderDiscountOp = outputData.operations.find(op => op.orderDiscountsAdd);
      const productDiscountOp = outputData.operations.find(op => op.productDiscountsAdd);

      console.log('\\n=== DISCOUNT OPERATION ANALYSIS ===');
      
      if (orderDiscountOp) {
        console.log('Order Discount Operation:');
        console.log('- Message:', orderDiscountOp.orderDiscountsAdd.candidates[0].message);
        console.log('- Value:', JSON.stringify(orderDiscountOp.orderDiscountsAdd.candidates[0].value));
        console.log('- Selection Strategy:', orderDiscountOp.orderDiscountsAdd.selectionStrategy);
      }

      if (productDiscountOp) {
        console.log('Product Discount Operation:');
        console.log('- Message:', productDiscountOp.productDiscountsAdd.candidates[0].message);
        console.log('- Target Cart Line ID:', productDiscountOp.productDiscountsAdd.candidates[0].targets[0].cartLine.id);
        console.log('- Value:', JSON.stringify(productDiscountOp.productDiscountsAdd.candidates[0].value));
      }

      // Now validate this specific structure
      const result = await validateOutputWithMutation(
        outputData,
        discountSchema,
        'cartLinesDiscountsGenerateRun',
        'result'
      );

      expect(orderDiscountOp).toBeTruthy();
      expect(productDiscountOp).toBeTruthy();
      expect(result).toHaveProperty('valid');
    });

    it('should handle invalid discount operation structure', async () => {
      // Create invalid output data with wrong operation structure
      const invalidOutputData = {
        operations: [
          {
            invalidOperation: {  // This operation type doesn't exist
              candidates: [
                {
                  message: "Invalid operation",
                  value: { percentage: { value: "10.0" } }
                }
              ]
            }
          }
        ]
      };

      const result = await validateOutputWithMutation(
        invalidOutputData,
        discountSchema,
        'cartLinesDiscountsGenerateRun',
        'result'
      );

      console.log('\\n=== INVALID DISCOUNT OPERATION VALIDATION ===');
      console.log('Invalid output data:', JSON.stringify(invalidOutputData, null, 2));
      console.log('Valid:', result.valid);
      console.log('Errors:', result.errors.length);
      if (result.errors.length > 0) {
        console.log('Error messages:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.message}`);
        });
      }

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should detect the invalid operation type
      const errorMessages = result.errors.map(e => e.message).join(' ');
      expect(errorMessages).toMatch(/(invalidOperation|not defined|unknown field)/i);
    });
  });

  describe('Complete Fixture Validation', () => {
    it('should validate the complete fixture structure and metadata', () => {
      console.log('\\n=== COMPLETE FIXTURE STRUCTURE ===');
      console.log('Shop ID:', discountFixture.shopId);
      console.log('API Client ID:', discountFixture.apiClientId);
      console.log('Function ID:', discountFixture.payload.functionId);
      console.log('Target:', discountFixture.payload.target);
      console.log('Export:', discountFixture.payload.export);
      console.log('Status:', discountFixture.status);
      console.log('Source:', discountFixture.source);
      console.log('Source Namespace:', discountFixture.sourceNamespace);
      console.log('Fuel Consumed:', discountFixture.payload.fuelConsumed);
      console.log('Input Bytes:', discountFixture.payload.inputBytes);
      console.log('Output Bytes:', discountFixture.payload.outputBytes);

      // Validate fixture structure
      expect(discountFixture).toHaveProperty('shopId');
      expect(discountFixture).toHaveProperty('payload');
      expect(discountFixture.payload).toHaveProperty('input');
      expect(discountFixture.payload).toHaveProperty('output');
      expect(discountFixture.payload.target).toBe('cart.lines.discounts.generate.run');
      expect(discountFixture.payload.export).toBe('cart_lines_discounts_generate_run');
      expect(discountFixture.status).toBe('success');
      expect(discountFixture.source).toBe('discount-function');
    });

    it('should demonstrate complete validation workflow', async () => {
      console.log('\\n=== COMPLETE VALIDATION WORKFLOW ===');
      
      // Step 1: Validate input
      console.log('Step 1: Validating input fixture...');
      const inputResult = await validateInputFixtureWithOriginalSchema(
        discountFixture.payload.input,
        discountSchema
      );
      console.log('Input validation result:', inputResult.valid ? '✅ PASS' : '❌ FAIL');

      // Step 2: Validate output
      console.log('Step 2: Validating output fixture...');
      const outputResult = await validateOutputWithMutation(
        discountFixture.payload.output,
        discountSchema,
        'cartLinesDiscountsGenerateRun',
        'result'
      );
      console.log('Output validation result:', outputResult.valid ? '✅ PASS' : '❌ FAIL');

      // Step 3: Summary
      const overallValid = inputResult.valid && outputResult.valid;
      console.log('\\n=== VALIDATION SUMMARY ===');
      console.log('Input validation:', inputResult.valid ? '✅ VALID' : '❌ INVALID');
      console.log('Output validation:', outputResult.valid ? '✅ VALID' : '❌ INVALID');
      console.log('Overall fixture validity:', overallValid ? '✅ VALID' : '❌ INVALID');

      if (!inputResult.valid) {
        console.log('Input errors:', inputResult.errors.length);
      }
      if (!outputResult.valid) {
        console.log('Output errors:', outputResult.errors.length);
      }

      expect(inputResult).toHaveProperty('valid');
      expect(outputResult).toHaveProperty('valid');
    });
  });
});
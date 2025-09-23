// Import the integration tests
require("../test-app/extensions/cart-validation-js/tests/default.test");
require("../test-app/extensions/discount-function/tests/default.test");

describe("Integration Tests", () => {
  // This file imports and runs the default.test.js integration tests
  test("runs the default.test.js integration tests", () => {
    expect(true).toBe(true);
  });
});
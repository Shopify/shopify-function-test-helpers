import { describe, test, expect } from "vitest";
// Import the integration tests
import "../test-app/extensions/cart-validation-js/tests/default.test.js";
import "../test-app/extensions/discount-function/tests/default.test.js";

describe("Integration Tests", () => {
  // This file imports and runs the default.test.js integration tests
  test("runs the default.test.js integration tests", () => {
    expect(true).toBe(true);
  });
});

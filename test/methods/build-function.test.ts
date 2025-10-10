import { describe, it, expect } from "vitest";
import { buildFunction } from "../../src/methods/build-function.ts";

describe("buildFunction", () => {
  it("should build a function using Shopify CLI", async () => {
    const result = await buildFunction(
      "test-app/extensions/cart-validation-js"
    );

    expect(result).toBeDefined();
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("error");
  }, 20000); // 20 second timeout for build operations
});

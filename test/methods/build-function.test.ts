import { describe, it, expect, vi, afterEach } from "vitest";
import { execa } from "execa";

import { buildFunction } from "../../src/methods/build-function.ts";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

describe("buildFunction", () => {
  const mockExeca = vi.mocked(execa);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should build a function successfully", async () => {
    mockExeca.mockResolvedValue({
      stdout: "Build completed successfully",
      stderr: "",
      exitCode: 0,
    } as any);

    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.output).toContain("Build completed successfully");
    expect(result.error).toBeNull();

    // Verify execa was called with correct arguments
    expect(mockExeca).toHaveBeenCalledWith(
      "shopify",
      ["app", "function", "build", "--path", expect.any(String)],
      expect.objectContaining({
        cwd: expect.any(String),
        env: expect.objectContaining({
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        }),
      }),
    );
  });

  it("should handle build failures", async () => {
    const error: any = new Error("Command failed");
    error.exitCode = 1;
    error.stderr = "Build failed: syntax error";
    mockExeca.mockRejectedValue(error);

    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    await expect(resultPromise).rejects.toThrow(
      "Build command failed with exit code 1",
    );
  });

  it("should handle process spawn errors", async () => {
    const error = new Error("ENOENT: command not found");
    mockExeca.mockRejectedValue(error);

    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    await expect(resultPromise).rejects.toThrow(
      "Failed to start shopify build command",
    );
  });
});

import { EventEmitter } from "events";
import { spawn } from "child_process";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { buildFunction } from "../../src/methods/build-function.ts";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("buildFunction", () => {
  const mockSpawn = vi.mocked(spawn);
  let mockProcess: any;

  beforeEach(() => {
    // Create a mock process object that extends EventEmitter
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    // Configure the mock to return our mock process
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should build a function successfully", async () => {
    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    // Simulate successful build
    setImmediate(() => {
      mockProcess.stdout.emit(
        "data",
        Buffer.from("Build completed successfully"),
      );
      mockProcess.emit("close", 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.output).toContain("Build completed successfully");
    expect(result.error).toBeNull();

    // Verify spawn was called with correct arguments
    expect(mockSpawn).toHaveBeenCalledWith(
      "shopify",
      ["app", "function", "build", "--path", expect.any(String)],
      expect.objectContaining({
        cwd: expect.any(String),
        env: expect.objectContaining({
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        }),
        stdio: ["pipe", "pipe", "pipe"],
      }),
    );
  });

  it("should handle build failures", async () => {
    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    // Simulate build failure
    setImmediate(() => {
      mockProcess.stderr.emit(
        "data",
        Buffer.from("Build failed: syntax error"),
      );
      mockProcess.emit("close", 1);
    });

    await expect(resultPromise).rejects.toThrow(
      "Build command failed with exit code 1",
    );
  });

  it("should handle process spawn errors", async () => {
    const resultPromise = buildFunction(
      "test-app/extensions/cart-validation-js",
    );

    // Simulate spawn error
    setImmediate(() => {
      const error = new Error("ENOENT: command not found");
      mockProcess.emit("error", error);
    });

    await expect(resultPromise).rejects.toThrow(
      "Failed to start shopify build command",
    );
  });
});

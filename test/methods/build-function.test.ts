import { EventEmitter } from "events";
import * as childProcess from "child_process";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { buildFunction } from "../../src/methods/build-function.ts";

// Mock child_process
vi.mock("child_process");

describe("buildFunction", () => {
  let mockProcess: EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  beforeEach(() => {
    // Create mock process with stdout and stderr
    mockProcess = new EventEmitter() as typeof mockProcess;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    // Mock spawn to return our mock process
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
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
    expect(childProcess.spawn).toHaveBeenCalledWith(
      "shopify",
      ["app", "function", "build", "--path", expect.any(String)],
      expect.objectContaining({
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

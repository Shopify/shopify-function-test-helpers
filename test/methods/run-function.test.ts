import { EventEmitter } from "events";
import { Writable } from "stream";
import * as childProcess from "child_process";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runFunction } from "../../src/methods/run-function.ts";

// Mock child_process
vi.mock("child_process");

describe("runFunction", () => {
  let mockStdin: Writable & { end: ReturnType<typeof vi.fn> };
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;
  let mockProcess: EventEmitter & {
    stdin: typeof mockStdin;
    stdout: typeof mockStdout;
    stderr: typeof mockStderr;
  };

  beforeEach(() => {
    // Create mock stdin with write and end methods
    mockStdin = new Writable() as Writable & { end: ReturnType<typeof vi.fn> };
    mockStdin.write = vi.fn().mockReturnValue(true);
    mockStdin.end = vi.fn();

    // Create mock stdout and stderr
    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();

    // Create mock process
    mockProcess = new EventEmitter() as typeof mockProcess;
    mockProcess.stdin = mockStdin;
    mockProcess.stdout = mockStdout;
    mockProcess.stderr = mockStderr;

    // Mock spawn to return our mock process
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should run a function successfully", async () => {
    const exportName = "cart-validations-generate-run";
    const input = {
      cart: {
        lines: [{ quantity: 1 }],
      },
    };

    const resultPromise = runFunction(
      exportName,
      input,
      "test-app/extensions/cart-validation-js",
    );

    // Simulate successful function execution
    setImmediate(() => {
      mockStdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            output: {
              operations: [],
            },
          }),
        ),
      );
      mockProcess.emit("close", 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toBeNull();
    expect(result.result).toHaveProperty("output");

    // Verify input was written to stdin
    expect(mockStdin.write).toHaveBeenCalledWith(JSON.stringify(input));
    expect(mockStdin.end).toHaveBeenCalled();
  });

  it("should handle function execution errors", async () => {
    const exportName = "invalid_export";
    const input = { cart: { lines: [] } };

    const resultPromise = runFunction(
      exportName,
      input,
      "test-app/extensions/cart-validation-js",
    );

    // Simulate function-runner error
    setImmediate(() => {
      mockStderr.emit("data", Buffer.from("Error: Export not found"));
      mockProcess.emit("close", 1);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain("Command failed with exit code 1");
    expect(result.error).toContain("Error: Export not found");
    expect(result.result).toBeNull();
  });

  it("should handle process spawn errors", async () => {
    const exportName = "cart-validations-generate-run";
    const input = { cart: { lines: [] } };

    const resultPromise = runFunction(
      exportName,
      input,
      "test-app/extensions/cart-validation-js",
    );

    // Simulate spawn error
    setImmediate(() => {
      const error = new Error("ENOENT: no such file or directory");
      mockProcess.emit("error", error);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain("Failed to start shopify command");
    expect(result.error).toContain("ENOENT");
    expect(result.result).toBeNull();
  });
});

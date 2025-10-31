import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

import { getFunctionInfo } from "../../src/methods/get-function-info.ts";

// Mock child_process module
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("getFunctionInfo", () => {
  let mockSpawn: any;
  let mockProcess: any;

  beforeEach(async () => {
    // Import the mocked spawn function
    const { spawn } = await import("child_process");
    mockSpawn = spawn as any;

    // Create a mock process object that extends EventEmitter
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    // Reset the mock before each test
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully retrieve function info from Shopify CLI", async () => {
    const mockFunctionInfo = {
      schemaPath: "/path/to/schema.graphql",
      functionRunnerPath: "/path/to/function-runner.wasm",
      wasmPath: "/path/to/function.wasm",
      targeting: {
        target: "purchase.payment-customization.run",
        version: "2024-01",
      },
    };

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    // Simulate successful CLI response
    setTimeout(() => {
      mockProcess.stdout.emit("data", JSON.stringify(mockFunctionInfo));
      mockProcess.emit("close", 0);
    }, 10);

    const result = await promise;

    expect(result).toEqual(mockFunctionInfo);
    expect(mockSpawn).toHaveBeenCalledWith(
      "shopify",
      ["app", "function", "info", "--json", "--path", "my-function"],
      {
        cwd: "/path/to/extensions",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("should reject when CLI command is not found", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.stderr.emit(
        "data",
        "Error: Command app function info not found",
      );
      mockProcess.emit("close", 1);
    }, 10);

    await expect(promise).rejects.toThrow(
      'The "shopify app function info" command is not available',
    );
    await expect(promise).rejects.toThrow(
      "Please upgrade to the latest version",
    );
  });

  it("should reject when shopify command is not found", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.stderr.emit("data", "shopify: command not found");
      mockProcess.emit("close", 127);
    }, 10);

    await expect(promise).rejects.toThrow(
      'The "shopify app function info" command is not available',
    );
  });

  it("should reject when CLI command fails with non-zero exit code", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.stderr.emit("data", "Error: Function not found\n");
      mockProcess.emit("close", 1);
    }, 10);

    await expect(promise).rejects.toThrow(
      "Function info command failed with exit code 1",
    );
    await expect(promise).rejects.toThrow("Error: Function not found");
  });

  it("should reject when JSON parsing fails", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.stdout.emit("data", "Invalid JSON output");
      mockProcess.emit("close", 0);
    }, 10);

    await expect(promise).rejects.toThrow("Failed to parse function info JSON");
    await expect(promise).rejects.toThrow("Invalid JSON output");
  });

  it("should reject when spawn process emits an error", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.emit("error", new Error("ENOENT: spawn failed"));
    }, 10);

    await expect(promise).rejects.toThrow(
      "Failed to start shopify function info command",
    );
    await expect(promise).rejects.toThrow("ENOENT: spawn failed");
  });

  it("should accumulate stderr output for error messages", async () => {
    const promise = getFunctionInfo("/path/to/extensions/my-function");

    setTimeout(() => {
      mockProcess.stderr.emit("data", "Error line 1\n");
      mockProcess.stderr.emit("data", "Error line 2\n");
      mockProcess.stderr.emit("data", "Error line 3");
      mockProcess.emit("close", 1);
    }, 10);

    await expect(promise).rejects.toThrow("Error line 1");
    await expect(promise).rejects.toThrow("Error line 2");
    await expect(promise).rejects.toThrow("Error line 3");
  });
});

import path from "path";

import { describe, it, expect, vi, afterEach } from "vitest";
import { execa } from "execa";

import { getFunctionInfo } from "../../src/methods/get-function-info.ts";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

describe("getFunctionInfo", () => {
  const mockExeca = vi.mocked(execa);

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

    mockExeca.mockResolvedValue({
      stdout: JSON.stringify(mockFunctionInfo),
      stderr: "",
      exitCode: 0,
    } as any);

    const functionDir = "/path/to/extensions/my-function";
    const promise = getFunctionInfo(functionDir);

    const result = await promise;

    // Calculate expected cwd the same way the implementation does
    const resolvedFunctionDir = path.resolve(functionDir);
    const expectedCwd = path.dirname(resolvedFunctionDir);

    expect(result).toEqual(mockFunctionInfo);
    expect(mockExeca).toHaveBeenCalledWith(
      "shopify",
      ["app", "function", "info", "--json", "--path", "my-function"],
      expect.objectContaining({
        cwd: expectedCwd,
        env: expect.objectContaining({
          SHOPIFY_INVOKED_BY: "shopify-function-test-helpers",
        }),
      }),
    );
  });

  it("should reject when CLI command is not found", async () => {
    const error: any = new Error("Command failed");
    error.exitCode = 1;
    error.stderr = "Error: Command app function info not found";
    mockExeca.mockRejectedValue(error);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow(
      'The "shopify app function info" command is not available',
    );
    await expect(promise).rejects.toThrow(
      "Please upgrade to the latest version",
    );
  });

  it("should reject when shopify command is not found", async () => {
    const error: any = new Error("Command failed");
    error.exitCode = 127;
    error.stderr = "shopify: command not found";
    mockExeca.mockRejectedValue(error);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow(
      'The "shopify app function info" command is not available',
    );
  });

  it("should reject when CLI command fails with non-zero exit code", async () => {
    const error: any = new Error("Command failed");
    error.exitCode = 1;
    error.stderr = "Error: Function not found\n";
    mockExeca.mockRejectedValue(error);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow(
      "Function info command failed with exit code 1",
    );
    await expect(promise).rejects.toThrow("Error: Function not found");
  });

  it("should reject when JSON parsing fails", async () => {
    mockExeca.mockResolvedValue({
      stdout: "Invalid JSON output",
      stderr: "",
      exitCode: 0,
    } as any);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow("Failed to parse function info JSON");
    await expect(promise).rejects.toThrow("Invalid JSON output");
  });

  it("should reject when spawn process emits an error", async () => {
    const error = new Error("ENOENT: spawn failed");
    mockExeca.mockRejectedValue(error);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow(
      "Failed to start shopify function info command",
    );
    await expect(promise).rejects.toThrow("ENOENT: spawn failed");
  });

  it("should accumulate stderr output for error messages", async () => {
    const error: any = new Error("Command failed");
    error.exitCode = 1;
    error.stderr = "Error line 1\nError line 2\nError line 3";
    mockExeca.mockRejectedValue(error);

    const promise = getFunctionInfo("/path/to/extensions/my-function");

    await expect(promise).rejects.toThrow("Error line 1");
    await expect(promise).rejects.toThrow("Error line 2");
    await expect(promise).rejects.toThrow("Error line 3");
  });
});

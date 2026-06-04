import { EventEmitter } from "events";
import { Writable } from "stream";
import { spawn } from "child_process";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runFunction } from "../../src/methods/run-function.ts";
import { FixtureData } from "../../src/methods/load-fixture.ts";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("runFunction", () => {
  const mockSpawn = vi.mocked(spawn);
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

    // Configure the mock to return our mock process
    mockSpawn.mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function runnerOutputJson(
    change?: (result: Record<string, unknown>) => void,
  ): string {
    const result: Record<string, unknown> = {
      output: { operations: [] },
      instructions: 4423,
      size: 49,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      memory_usage: 1088,
    };

    change?.(result);

    return JSON.stringify(result);
  }

  async function runFunctionWithStdout(stdout: string) {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const resultPromise = runFunction(
      fixture,
      "/path/to/function-runner",
      "/path/to/function.wasm",
      "/path/to/query.graphql",
      "/path/to/schema.graphql",
    );

    setImmediate(() => {
      mockStdout.emit("data", Buffer.from(stdout));
      mockProcess.emit("close", 0);
    });

    return resultPromise;
  }

  it("should run a function successfully and return result", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: {
        cart: {
          lines: [{ quantity: 1 }],
        },
      },
      expectedOutput: {
        operations: [],
      },
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/function-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    // Simulate successful function execution
    const expectedOutput = {
      size: 49,
      instructions: 4423,
      output: {
        operations: [],
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      memory_usage: 1088,
    };
    setImmediate(() => {
      mockStdout.emit("data", Buffer.from(JSON.stringify(expectedOutput)));
      mockProcess.emit("close", 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toBeNull();
    expect(result.result).toEqual({ output: expectedOutput.output });
    expect(result.metadata).toEqual({
      instructionCount: 4423,
      memoryUsageKiB: 1088,
      moduleSizeKiB: 49,
    });

    // Verify spawn was called with correct arguments
    expect(mockSpawn).toHaveBeenCalledWith(
      functionRunnerPath,
      [
        "-f",
        wasmPath,
        "--export",
        fixture.export,
        "--query-path",
        inputQueryPath,
        "--schema-path",
        schemaPath,
        "--json",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    // Verify input was written to stdin
    expect(mockStdin.write).toHaveBeenCalledWith(JSON.stringify(fixture.input));
    expect(mockStdin.end).toHaveBeenCalled();
  });

  it("should handle function execution errors with non-zero exit code", async () => {
    const fixture: FixtureData = {
      export: "invalid_export",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/function-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    // Simulate function-runner error
    setImmediate(() => {
      mockStderr.emit("data", Buffer.from("Error: Export not found"));
      mockProcess.emit("close", 1);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain("function-runner failed with exit code 1");
    expect(result.error).toContain("Error: Export not found");
    expect(result.result).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it("should handle process spawn errors", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/nonexistent-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    // Simulate spawn error
    setImmediate(() => {
      const error = new Error("ENOENT: no such file or directory");
      mockProcess.emit("error", error);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain("Failed to start function-runner");
    expect(result.error).toContain("ENOENT");
    expect(result.result).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it("should handle invalid JSON output from function-runner", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/function-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    // Simulate invalid JSON output
    setImmediate(() => {
      mockStdout.emit("data", Buffer.from("invalid json {{{"));
      mockProcess.emit("close", 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain("Failed to parse function-runner output");
    expect(result.result).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it("should handle multiple stdout/stderr chunks", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/function-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    // Simulate output in multiple chunks
    const outputPart1 =
      '{"name":"function.wasm","size":49,"instructions":4423,"logs":"","input":{},"output":';
    const outputPart2 = '{"operations":[]}';
    const outputPart3 = ',"success":true,"memory_usage":1088}';

    setImmediate(() => {
      mockStdout.emit("data", Buffer.from(outputPart1));
      mockStdout.emit("data", Buffer.from(outputPart2));
      mockStdout.emit("data", Buffer.from(outputPart3));
      mockProcess.emit("close", 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toBeNull();
    expect(result.result).toEqual({
      output: {
        operations: [],
      },
    });
    expect(result.metadata).toEqual({
      instructionCount: 4423,
      memoryUsageKiB: 1088,
      moduleSizeKiB: 49,
    });
  });

  it("should return function-runner error without metadata for invalid JSON shape on non-zero exit code", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const resultPromise = runFunction(
      fixture,
      "/path/to/function-runner",
      "/path/to/function.wasm",
      "/path/to/query.graphql",
      "/path/to/schema.graphql",
    );

    setImmediate(() => {
      mockStdout.emit("data", Buffer.from(JSON.stringify({ error: "boom" })));
      mockStderr.emit("data", Buffer.from("Function failed"));
      mockProcess.emit("close", 1);
    });

    const result = await resultPromise;

    expect(result.error).toContain("function-runner failed with exit code 1");
    expect(result.error).toContain("Function failed");
    expect(result.result).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it("should return metadata from parseable output on non-zero exit code", async () => {
    const fixture: FixtureData = {
      export: "cart-validations-generate-run",
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: "cart.validations.generate.run",
    };

    const functionRunnerPath = "/path/to/function-runner";
    const wasmPath = "/path/to/function.wasm";
    const inputQueryPath = "/path/to/query.graphql";
    const schemaPath = "/path/to/schema.graphql";

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath,
    );

    setImmediate(() => {
      mockStdout.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            size: 42,
            instructions: 999,
            output: {},
            // eslint-disable-next-line @typescript-eslint/naming-convention
            memory_usage: 1000,
          }),
        ),
      );
      mockStderr.emit("data", Buffer.from("Function failed"));
      mockProcess.emit("close", 1);
    });

    const result = await resultPromise;

    expect(result.error).toContain("function-runner failed with exit code 1");
    expect(result.error).toContain("Function failed");
    expect(result.result).toBeNull();
    expect(result.metadata).toEqual({
      instructionCount: 999,
      memoryUsageKiB: 1000,
      moduleSizeKiB: 42,
    });
  });

  it.each([
    ["null", () => JSON.stringify(null)],
    ["string", () => JSON.stringify("not an object")],
    [
      "missing output",
      () => runnerOutputJson((result) => delete result.output),
    ],
    [
      "missing instructions",
      () => runnerOutputJson((result) => delete result.instructions),
    ],
    [
      "non-number instructions",
      () => runnerOutputJson((result) => (result.instructions = "4423")),
    ],
    [
      "missing memory usage",
      () => runnerOutputJson((result) => delete result.memory_usage),
    ],
    [
      "non-number memory usage",
      () => runnerOutputJson((result) => (result.memory_usage = "1088")),
    ],
    ["missing size", () => runnerOutputJson((result) => delete result.size)],
    [
      "non-number size",
      () => runnerOutputJson((result) => (result.size = "49")),
    ],
  ])(
    "should reject invalid function-runner JSON shape: %s",
    async (_name, getStdout) => {
      const result = await runFunctionWithStdout(getStdout());

      expect(result).toBeDefined();
      expect(result.error).toContain(
        "function-runner returned unexpected format",
      );
      expect(result.result).toBeNull();
      expect(result.metadata).toBeNull();
    },
  );
});

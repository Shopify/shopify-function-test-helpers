import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Writable } from 'stream';
import * as childProcess from 'child_process';
import { runFunction } from '../../src/methods/run-function.ts';
import { FixtureData } from '../../src/methods/load-fixture.ts';

// Mock child_process
vi.mock('child_process');

describe('runFunction', () => {
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

  it('should run a function successfully and return result', async () => {
    const fixture: FixtureData = {
      export: 'cart-validations-generate-run',
      input: {
        cart: {
          lines: [{ quantity: 1 }]
        }
      },
      expectedOutput: {
        operations: []
      },
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/function-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate successful function execution
    setImmediate(() => {
      mockStdout.emit('data', Buffer.from(JSON.stringify({
        output: {
          operations: []
        }
      })));
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toBeNull();
    expect(result.result).toEqual({
      output: {
        operations: []
      }
    });

    // Verify spawn was called with correct arguments
    expect(childProcess.spawn).toHaveBeenCalledWith(
      functionRunnerPath,
      [
        '-f', wasmPath,
        '--export', fixture.export,
        '--query-path', inputQueryPath,
        '--schema-path', schemaPath,
        '--json',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Verify input was written to stdin
    expect(mockStdin.write).toHaveBeenCalledWith(
      JSON.stringify(fixture.input)
    );
    expect(mockStdin.end).toHaveBeenCalled();
  });

  it('should handle function execution errors with non-zero exit code', async () => {
    const fixture: FixtureData = {
      export: 'invalid_export',
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/function-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate function-runner error
    setImmediate(() => {
      mockStderr.emit('data', Buffer.from('Error: Export not found'));
      mockProcess.emit('close', 1);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain('function-runner failed with exit code 1');
    expect(result.error).toContain('Error: Export not found');
    expect(result.result).toBeNull();
  });

  it('should handle process spawn errors', async () => {
    const fixture: FixtureData = {
      export: 'cart-validations-generate-run',
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/nonexistent-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate spawn error
    setImmediate(() => {
      const error = new Error('ENOENT: no such file or directory');
      mockProcess.emit('error', error);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain('Failed to start function-runner');
    expect(result.error).toContain('ENOENT');
    expect(result.result).toBeNull();
  });

  it('should handle invalid JSON output from function-runner', async () => {
    const fixture: FixtureData = {
      export: 'cart-validations-generate-run',
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/function-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate invalid JSON output
    setImmediate(() => {
      mockStdout.emit('data', Buffer.from('invalid json {{{'));
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain('Failed to parse function-runner output');
    expect(result.result).toBeNull();
  });

  it('should handle multiple stdout/stderr chunks', async () => {
    const fixture: FixtureData = {
      export: 'cart-validations-generate-run',
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/function-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate output in multiple chunks
    const outputPart1 = '{"output":';
    const outputPart2 = '{"operations":[]}';
    const outputPart3 = '}';

    setImmediate(() => {
      mockStdout.emit('data', Buffer.from(outputPart1));
      mockStdout.emit('data', Buffer.from(outputPart2));
      mockStdout.emit('data', Buffer.from(outputPart3));
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toBeNull();
    expect(result.result).toEqual({
      output: {
        operations: []
      }
    });
  });

  it('should reject output without explicit output wrapper', async () => {
    const fixture: FixtureData = {
      export: 'cart-validations-generate-run',
      input: { cart: { lines: [] } },
      expectedOutput: {},
      target: 'cart.validations.generate.run'
    };

    const functionRunnerPath = '/path/to/function-runner';
    const wasmPath = '/path/to/function.wasm';
    const inputQueryPath = '/path/to/query.graphql';
    const schemaPath = '/path/to/schema.graphql';

    const resultPromise = runFunction(
      fixture,
      functionRunnerPath,
      wasmPath,
      inputQueryPath,
      schemaPath
    );

    // Simulate output without "output" wrapper
    setImmediate(() => {
      mockStdout.emit('data', Buffer.from(JSON.stringify({
        operations: []
      })));
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.error).toContain('function-runner returned unexpected format');
    expect(result.error).toContain('missing \'output\' field');
    expect(result.result).toBeNull();
  });
});

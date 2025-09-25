import { describe, it, expect } from 'vitest';
import path from 'path';
import { OperationDefinitionNode } from 'graphql';
import { loadInputQuery } from '../../src/wasm-testing-helpers.ts';

describe('loadInputQuery', () => {
  it('should load and parse a GraphQL query file', async () => {
    const queryPath = path.join(process.cwd(), 'test/fixtures/test-query.graphql');
    
    const document = await loadInputQuery(queryPath);
    
    expect(document).toBeDefined();
    expect(document.kind).toBe('Document');
    expect(document.definitions).toHaveLength(1);
    expect(document.definitions[0].kind).toBe('OperationDefinition');
    expect((document.definitions[0] as OperationDefinitionNode).operation).toBe('query');
  });

  it('should throw an error for non-existent file', async () => {
    const nonExistentPath = path.join(process.cwd(), 'test/fixtures/nonexistent.graphql');
    
    await expect(loadInputQuery(nonExistentPath)).rejects.toThrow('Failed to load input query from');
  });

  it('should throw an error for invalid GraphQL', async () => {
    const queryPath = path.join(process.cwd(), 'test/fixtures/invalid-query.graphql');
    
    await expect(loadInputQuery(queryPath)).rejects.toThrow('Failed to load input query from');
  });
});
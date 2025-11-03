import fs from "fs";
import path from "path";

import { describe, test, expect, beforeAll } from "vitest";
import { buildSchema, GraphQLSchema } from "graphql";

import { determineMutationFromTarget } from "../../src/utils/determine-mutation-from-target.ts";

describe("determineMutationFromTarget", () => {
  let testSchema: GraphQLSchema;

  beforeAll(() => {
    const schemaPath = path.join(__dirname, "../fixtures/test-schema.graphql");
    const schemaString = fs.readFileSync(schemaPath, "utf8");
    testSchema = buildSchema(schemaString);
  });

  test("finds mutation by target in description", () => {
    const result = determineMutationFromTarget(
      "data.processing.generate.run",
      testSchema,
    );

    expect(result).toEqual({
      mutationName: "processData",
      resultParameterName: "result",
    });
  });

  test("finds mutation and returns actual parameter name from schema", () => {
    const result = determineMutationFromTarget(
      "data.fetching.generate.run",
      testSchema,
    );

    expect(result).toEqual({
      mutationName: "fetchData",
      resultParameterName: "input",
    });
  });

  test("throws error when target not found", () => {
    expect(() => {
      determineMutationFromTarget("nonexistent.target", testSchema);
    }).toThrow("No mutation found for target 'nonexistent.target'");
  });
});

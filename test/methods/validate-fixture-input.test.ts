import { describe, it, expect, beforeAll } from "vitest";
import { validateFixtureInput } from "../../src/methods/validate-fixture-input.ts";
import { loadSchema } from "../../src/methods/load-schema.ts";
import { loadInputQuery } from "../../src/methods/load-input-query.ts";
import { loadFixture } from "../../src/methods/load-fixture.ts";
import { GraphQLSchema, parse } from "graphql";

describe("validateFixtureInput", () => {
  let schema: GraphQLSchema;

  beforeAll(async () => {
    schema = await loadSchema("./test/fixtures/test-schema.graphql");
  });

  describe("Valid Fixtures", () => {
    it("valid/basic.json + queries/valid/basic.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/basic.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/basic.json"
      );

      const result = validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    });

    it("valid/aliased.json + queries/valid/aliased.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/aliased.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/aliased.json"
      );

      const result = validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/multiple-aliases-same-field.json + queries/valid/multiple-aliases-same-field.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/multiple-aliases-same-field.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/multiple-aliases-same-field.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/named-fragments.json + queries/valid/named-fragments.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/named-fragments.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/named-fragments.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Skipping this test because it's not yet supported
    // it("valid/inline-fragments.json + queries/valid/inline-fragments.graphql", async () => {
    //   const queryAST = await loadInputQuery(
    //     "./test/fixtures/queries/valid/inline-fragments.graphql"
    //   );
    //   const fixture = await loadFixture(
    //     "./test/fixtures/data/valid/inline-fragments.json"
    //   );

    //   const result = await validateFixtureInput(queryAST, schema, fixture.input);

    //   console.log(result);

    //   expect(result.valid).toBe(true);
    //   expect(result.errors).toHaveLength(0);
    // });

    it("valid/nested-inline-fragments.json + queries/valid/nested-inline-fragments.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/nested-inline-fragments.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/nested-inline-fragments.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/different-aliases-in-fragments.json + queries/valid/different-aliases-in-fragments.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/different-aliases-in-fragments.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/different-aliases-in-fragments.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/aliased-field-in-fragments.json + queries/valid/aliased-field-in-fragments.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/aliased-field-in-fragments.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/aliased-field-in-fragments.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/with-variables.json + queries/valid/with-variables.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/with-variables.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/with-variables.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("valid/field-args.json + queries/valid/field-args.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/field-args.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/valid/field-args.json"
      );

      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("handles nested lists [[Item]]", async () => {
      const queryAST = parse(`
        query {
          data {
            itemMatrix {
              id
              count
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          itemMatrix: [
            [
              { id: "1", count: 10 },
              { id: "2", count: 20 }
            ],
            [
              { id: "3", count: 30 },
              { id: "4", count: 40 },
              { id: "5", count: 50 }
            ],
            [
              { id: "6", count: 60 }
            ]
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("handles deeply nested lists [[[Metadata]]]", async () => {
      const queryAST = parse(`
        query {
          data {
            metadataCube {
              email
              phone
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          metadataCube: [
            [
              [
                { email: "user1@example.com", phone: "555-0001" },
                { email: "user2@example.com", phone: "555-0002" }
              ],
              [
                { email: "user3@example.com", phone: "555-0003" }
              ]
            ],
            [
              [
                { email: "user4@example.com", phone: "555-0004" }
              ]
            ],
            [
              [
                { email: "user5@example.com", phone: "555-0005" },
                { email: "user6@example.com", phone: "555-0006" }
              ],
              [
                { email: "user7@example.com", phone: "555-0007" },
                { email: "user8@example.com", phone: "555-0008" },
                { email: "user9@example.com", phone: "555-0009" }
              ]
            ]
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Skipping this test because it's not yet supported
    // it("valid/complete-test.json + queries/valid/complete-test.graphql", async () => {
    //   const queryAST = await loadInputQuery(
    //     "./test/fixtures/queries/valid/complete-test.graphql"
    //   );
    //   const fixture = await loadFixture(
    //     "./test/fixtures/data/valid/complete-test.json"
    //   );

    //   const result = await validateFixtureInput(queryAST, schema, fixture.input);

    //   expect(result.valid).toBe(true);
    //   expect(result.errors).toHaveLength(0);
    // });

    // it("valid/complete-test-with-variables.json + queries/valid/complete-test.graphql", async () => {
    //   const queryAST = await loadInputQuery(
    //     "./test/fixtures/queries/valid/complete-test.graphql"
    //   );
    //   const fixture = await loadFixture(
    //     "./test/fixtures/data/valid/complete-test-with-variables.json"
    //   );

    //   const result = await validateFixtureInput(queryAST, schema, fixture.input);

    //   expect(result.valid).toBe(true);
    //   expect(result.errors).toHaveLength(0);
    // });
  });

  describe("Invalid Fixtures", () => {
    it("invalid/incomplete.json + queries/valid/basic.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/basic.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/invalid/incomplete.json"
      );
      const result = await validateFixtureInput(queryAST, schema, fixture.input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toBe("Missing expected fixture data for count");
      expect(result.errors[1]).toBe(
        "Missing expected fixture data for details"
      );
      expect(result.errors[2]).toBe(
        "Missing expected fixture data for metadata"
      );
    });

    // // Skipping this test because it's not yet supported
    // it("invalid/extra-fields.json + queries/valid/basic.graphql", async () => {
    //   const queryAST = await loadInputQuery(
    //     "./test/fixtures/queries/valid/basic.graphql"
    //   );
    //   const fixture = await loadFixture(
    //     "./test/fixtures/data/invalid/extra-fields.json"
    //   );
    //   const result = await validateFixtureInput(queryAST, schema, fixture.input);

    //   expect(result.valid).toBe(false);
    //   expect(result.errors.length).toBe(3);
    //   expect(result.errors[0]).toBe('Missing field "metadata" at data');
    //   expect(result.errors[1]).toBe('Missing field "details" at data.items[0]');
    //   expect(result.errors[2]).toBe(
    //     'Extra field "extraField" at data.items[0]'
    //   );
    // });
    it("invalid/scalar-mismatch.json + queries/valid/basic.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/basic.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/invalid/scalar-mismatch.json"
      );
      const result = await validateFixtureInput(queryAST, schema, fixture.input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBe("Expected object for data, but got string");
    });

    it("invalid/invalid-input.json + queries/valid/basic.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/basic.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/invalid/invalid-input.json"
      );
      const result = await validateFixtureInput(queryAST, schema, fixture.input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toBe(
        'Int cannot represent non-integer value: "not a number" At ""'
      );
      expect(result.errors[1]).toBe(
        "Missing expected fixture data for details"
      );
      expect(result.errors[2]).toBe(
        "Missing expected fixture data for metadata"
      );
    });

    it("invalid/missing-required-fields.json + queries/valid/basic.graphql", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/queries/valid/basic.graphql"
      );
      const fixture = await loadFixture(
        "./test/fixtures/data/invalid/missing-required-fields.json"
      );
      const result = await validateFixtureInput(queryAST, schema, fixture.input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBe(
        "Missing expected fixture data for metadata"
      );
    });
  });
});

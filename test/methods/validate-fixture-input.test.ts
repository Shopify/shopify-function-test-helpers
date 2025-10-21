import { describe, it, expect, beforeAll } from "vitest";
import { validateFixtureInput } from "../../src/methods/validate-fixture-input.ts";
import { loadSchema } from "../../src/methods/load-schema.ts";
import { GraphQLSchema, parse } from "graphql";

describe("validateFixtureInput", () => {
  let schema: GraphQLSchema;

  beforeAll(async () => {
    schema = await loadSchema("./test/fixtures/test-schema.graphql");
  });

  describe("Valid Fixtures", () => {
    it("validates basic fixture with all fields present", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              count: 2,
              details: {
                id: "gid://test/ItemDetails/123",
                name: "Test Item"
              }
            }
          ],
          metadata: {
            email: "test@example.com"
          }
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles field aliases", () => {
      const queryAST = parse(`
        query {
          data {
            allItems: items {
              id
              count
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          allItems: [
            {
              id: "gid://test/Item/1",
              count: 5
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles multiple aliases for the same field", () => {
      const queryAST = parse(`
        query Query {
          data {
            firstItems: items {
              id
              count
            }
            secondItems: items {
              id
              details {
                name
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          firstItems: [
            {
              id: "gid://test/Item/1",
              count: 5,
              details: {
                name: "First Item"
              }
            }
          ],
          secondItems: [
            {
              id: "gid://test/Item/1",
              count: 5,
              details: {
                name: "First Item"
              }
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles named fragments", () => {
      const queryAST = parse(`
        query {
          data {
            ...ItemFields
          }
        }

        fragment ItemFields on DataContainer {
          items {
            id
            count
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              count: 5
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    // This test is skipped because the validator doesn't yet support unions where
    // different items in the array can be different types. Currently, it expects
    // all fields from all inline fragments to be present in every item, instead of
    // filtering by __typename.
    it.skip("handles inline fragments with multiple types in union", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              __typename
              ... on Item {
                id
                count
              }
              ... on Metadata {
                email
                phone
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          searchResults: [
            {
              __typename: "Item",
              id: "gid://test/Item/1",
              count: 5
            },
            {
              __typename: "Metadata",
              email: "test@example.com",
              phone: "555-0001"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles nested inline fragments", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              ... on Item {
                id
                count
                details {
                  ... on ItemDetails {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          searchResults: [
            {
              id: "gid://test/Item/1",
              count: 5,
              details: {
                id: "gid://test/ItemDetails/1",
                name: "Test Item"
              }
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles different aliases in fragments", () => {
      const queryAST = parse(`
        fragment ItemFields on Item {
          itemId: id
          itemCount: count
        }

        fragment MoreItemFields on Item {
          itemId: id
          details {
            name
          }
        }

        query {
          data {
            items {
              ...ItemFields
              ...MoreItemFields
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              itemId: "gid://test/Item/1",
              itemCount: 5,
              details: {
                name: "Test Item"
              }
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles aliased fields in fragments", () => {
      const queryAST = parse(`
        fragment ItemInfo on Item {
          identifier: id
          quantity: count
        }

        query {
          data {
            items {
              ...ItemInfo
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              identifier: "gid://test/Item/1",
              quantity: 5
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles queries with variables", () => {
      const queryAST = parse(`
        query TestQuery($itemCount: Int) {
          data {
            items(first: $itemCount) {
              id
              count
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              count: 5
            },
            {
              id: "gid://test/Item/2",
              count: 10
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles fields with arguments", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              count
              details(itemId: "gid://test/Item/1") {
                id
                name
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              count: 5,
              details: {
                id: "gid://test/ItemDetails/123",
                name: "Test Item"
              }
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

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

      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Invalid Fixtures", () => {
    it("detects missing fields in fixture data", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toBe("Missing expected fixture data for count");
      expect(result.errors[1]).toBe(
        "Missing expected fixture data for details"
      );
      expect(result.errors[2]).toBe(
        "Missing expected fixture data for metadata"
      );
    });

    // This test is skipped because the validator doesn't yet detect extra fields
    // in fixture data that aren't present in the query. Currently, it only validates
    // that all required fields from the query are present in the fixture, but doesn't
    // flag additional fields that shouldn't be there.
    it.skip("detects extra fields not in query", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              count: 5,
            }
          ]
        }
      };


      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('count'))).toBe(true);
    });

    it("detects type mismatches (object vs scalar)", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixtureInput = {
        data: "this should be an object, not a string"
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBe("Expected object for data, but got string");
    });

    it("detects invalid scalar values", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: 123,
              count: "not a number"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

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

    it("detects missing required fields at root level", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
            metadata {
              email
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: []
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBe(
        "Missing expected fixture data for metadata"
      );
    });
  });
});

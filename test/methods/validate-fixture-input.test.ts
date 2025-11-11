import { describe, it, expect, beforeAll } from "vitest";
import { GraphQLSchema, parse } from "graphql";

import { validateFixtureInput } from "../../src/methods/validate-fixture-input.ts";
import { loadSchema } from "../../src/methods/load-schema.ts";
import { loadInputQuery } from "../../src/methods/load-input-query.ts";
import { loadFixture } from "../../src/methods/load-fixture.ts";

describe("validateFixtureInput", () => {
  let schema: GraphQLSchema;

  beforeAll(async () => {
    schema = await loadSchema("./test/fixtures/test-schema.graphql");
  });

  describe("Valid Fixtures", () => {
    it("validates default fixture", async () => {
      const queryAST = await loadInputQuery(
        "./test/fixtures/valid-query.graphql",
      );
      const fixture = await loadFixture("./test/fixtures/valid-fixture.json");
      const fixtureInput = fixture.input;

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
              count: 5,
            },
          ],
        },
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
            },
          ],
          secondItems: [
            {
              id: "gid://test/Item/1",
              details: {
                name: "First Item",
              },
            },
          ],
        },
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
              count: 5,
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles inline fragments with multiple types in union", () => {
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
              count: 5,
            },
            {
              __typename: "Metadata",
              email: "test@example.com",
              phone: "555-0001",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles aliased __typename in inline fragments", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              type: __typename
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
              type: "Item",
              id: "gid://test/Item/1",
              count: 5,
            },
            {
              type: "Metadata",
              email: "test@example.com",
              phone: "555-0001",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("should not inherit typename key across field boundaries", () => {
      const queryAST = parse(`
        query {
          data {
            nested {
              outerType: __typename
              ... on NestedOuterA {
                id
                inner {
                  ... on NestedInnerA {
                    name
                  }
                  ... on NestedInnerB {
                    value
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          nested: [
            {
              outerType: "NestedOuterA",
              id: "1",
              inner: [
                {
                  name: "Inner name",
                  // No __typename - query doesn't select it for inner
                },
              ],
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // - inner SelectionSet has typenameResponseKey = undefined (doesn't inherit "outerType")
      // - Detects missing __typename and BREAKs early
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing `__typename` field for abstract type `NestedInner`",
        path: ["data", "nested", "inner"],
      });
    });

    it("handles nested unions with typename at each level", () => {
      // Same structure as previous test, but WITH __typename at inner level
      const queryAST = parse(`
        query {
          data {
            nested {
              outerType: __typename
              ... on NestedOuterA {
                id
                inner {
                  __typename
                  ... on NestedInnerA {
                    name
                  }
                  ... on NestedInnerB {
                    value
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          nested: [
            {
              outerType: "NestedOuterA",
              id: "1",
              inner: [
                {
                  __typename: "NestedInnerA",
                  name: "Inner name",
                },
              ],
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // With __typename selected at inner level, validation works correctly
      // - outer uses "outerType" alias
      // - inner uses "__typename" (not inherited)
      // - Each level properly scoped to its field
      expect(result.errors).toHaveLength(0);
    });

    it("handles inline fragment on interface type", () => {
      const queryAST = parse(`
        query {
          data {
            products {
              __typename
              ... on Purchasable {
                price
                currency
              }
              ... on GiftCard {
                code
                balance
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          products: [
            {
              __typename: "PhysicalProduct",
              price: 1000,
              currency: "USD",
            },
            {
              __typename: "DigitalProduct",
              price: 500,
              currency: "USD",
            },
            {
              __typename: "GiftCard",
              code: "GIFT123",
              balance: 5000,
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles single inline fragment on union without __typename", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              ... on Item {
                id
                count
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
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // With only one inline fragment, no __typename is needed for discrimination
      expect(result.errors).toHaveLength(0);
    });

    it("handles empty objects in union when inline fragment doesn't match", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              ... on Item {
                id
                count
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
            },
            {}, // Empty object - represents Metadata that didn't match the Item fragment
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is valid - GraphQL returns this for union members that don't match any fragments
      expect(result.errors).toHaveLength(0);
    });

    it("handles empty objects when narrowing from union to interface subset", () => {
      const queryAST = parse(`
        query {
          data {
            products {
              ... on Purchasable {
                price
                currency
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          products: [
            {
              price: 1000,
              currency: "USD",
            },
            {}, // Empty object - GiftCard that doesn't implement Purchasable
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is valid
      // Grandparent (Product union) has 3 types: {PhysicalProduct, DigitalProduct, GiftCard}
      // Parent (Purchasable interface) has 2 types: {PhysicalProduct, DigitalProduct}
      // Sets are different → type was narrowed → empty object represents GiftCard
      expect(result.errors).toHaveLength(0);
    });

    it("handles deeply nested interface fragments with empty objects", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              ...on HasId {
                id
                ...on HasName {
                  name
                  ...on HasDescription {
                    description
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              id: "1",
              name: "Implementer1",
              description: "Has all three interfaces",
            },
            {
              id: "2",
              name: "Implementer2",
              description: "Also has all three",
            },
            {},
            // Empty object - NoInterfacesImplemented that doesn't implement any interface
            // Valid because InterfaceImplementersUnion {1,2,3,4} was narrowed to HasId {1,2,3}
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object is valid - demonstrates narrowing through 3 nested interface fragments
      // Progressive narrowing: InterfaceImplementersUnion {1,2,3,4} → HasId {1,2,3} → HasName {1,2} → HasDescription {1}
      // parentFieldType = InterfaceImplementersUnion (4 types), parentType = HasId (3 types after first fragment)
      // Sets are different → type was narrowed → empty object valid
      expect(result.errors).toHaveLength(0);
    });

    it("handles deeply nested fragments with field only at innermost level", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              ...on HasId {
                ...on HasName {
                  ...on HasDescription {
                    description
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              description: "Implementer1 - implements all three",
            },
            {},
            {},
            {},
            // Three empty objects representing Implementer2, 3, 4 that don't implement HasDescription
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // All empty objects are valid - they don't match the HasDescription fragment
      // parentFieldType = InterfaceImplementersUnion (4 types)
      // parentType = HasDescription (1 type)
      // Sets are different → narrowing detected → empty objects valid
      expect(result.errors).toHaveLength(0);
    });

    it("handles nested interface fragments with __typename and partial field sets", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              __typename
              ...on HasId {
                id
                ...on HasName {
                  name
                  ...on HasDescription {
                    description
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              __typename: "InterfaceImplementer1",
              id: "1",
              name: "Implementer1",
              description: "Implements all three",
            },
            {
              __typename: "InterfaceImplementer2",
              id: "2",
              name: "Implementer2",
              // Implements HasId & HasName, but not HasDescription
            },
            {
              __typename: "InterfaceImplementer3",
              id: "3",
              // Implements HasId only
            },
            {
              __typename: "NoInterfacesImplemented",
              // Doesn't implement any interface
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // With __typename, validator correctly discriminates which fields are expected for each type
      expect(result.errors).toHaveLength(0);
    });

    it("requires __typename for nested interface fragments with partial field sets", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              ...on HasId {
                id
                ...on HasName {
                  name
                  ...on HasDescription {
                    description
                  }
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              id: "1",
              name: "Implementer1",
              description: "Implements all three",
            },
            {
              id: "2",
              name: "Implementer2",
              // InterfaceImplementer2: implements HasId & HasName, but not HasDescription
              // This is a valid response - nested fragment doesn't match
            },
            {
              id: "3",
              // InterfaceImplementer3: implements HasId only
              // This is a valid response - nested fragments don't match
            },
            {},
            // NoInterfacesImplemented: doesn't implement any interface
            // Empty object is valid - handled by empty object logic
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Without __typename, validator cannot determine if missing fields are valid
      // (due to type not implementing nested interfaces) or invalid (incomplete data)
      // So it conservatively expects all selected fields on non-empty objects
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing expected fixture data for `name`",
        path: ["data", "interfaceImplementers", 2, "name"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Missing expected fixture data for `description`",
        path: ["data", "interfaceImplementers", 1, "description"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Missing expected fixture data for `description`",
        path: ["data", "interfaceImplementers", 2, "description"],
      });
    });

    it("handles objects with only __typename when inline fragment doesn't match", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              __typename
              ... on Item {
                id
                count
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
              count: 5,
            },
            {
              __typename: "Metadata", // Only typename, no other fields
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Object with only __typename is valid - Metadata doesn't match the Item fragment
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
                name: "Test Item",
              },
            },
          ],
        },
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
                name: "Test Item",
              },
            },
          ],
        },
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
              quantity: 5,
            },
          ],
        },
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
              count: 5,
            },
            {
              id: "gid://test/Item/2",
              count: 10,
            },
          ],
        },
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
                name: "Test Item",
              },
            },
          ],
        },
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
            [{ id: "1", count: 10 }, null, { id: "2", count: 20 }],
            null,
            [
              { id: "3", count: 30 },
              { id: "4", count: 40 },
              null,
              { id: "5", count: 50 },
            ],
            [{ id: "6", count: 60 }],
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles nested objects with nullable arrays", () => {
      const queryAST = parse(`
        query {
          data {
            itemMatrix {
              id
              count
              details {
                id
                name
                attributes {
                  key
                  value
                }
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          itemMatrix: [
            [
              {
                id: "gid://test/Item/1",
                count: 10,
                details: {
                  id: "gid://test/ItemDetails/1",
                  name: "Test Item",
                  attributes: [
                    { key: "color", value: "blue" },
                    null,
                    { key: "size", value: "large" },
                  ],
                },
              },
              {
                id: "gid://test/Item/2",
                count: 20,
                details: {
                  id: "gid://test/ItemDetails/2",
                  name: "Another Item",
                  attributes: null,
                },
              },
            ],
            null,
            [
              {
                id: "gid://test/Item/3",
                count: 30,
                details: {
                  id: "gid://test/ItemDetails/3",
                  name: "Third Item",
                  attributes: [
                    { key: "material", value: "cotton" },
                    null,
                    { key: "weight", value: "heavy" },
                  ],
                },
              },
              null,
              {
                id: "gid://test/Item/4",
                count: 40,
                details: {
                  id: "gid://test/ItemDetails/4",
                  name: "Fourth Item",
                  attributes: null,
                },
              },
            ],
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("handles null values for nullable fields", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              details {
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
              details: null,
            },
          ],
        },
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
                null,
                { email: "user2@example.com", phone: "555-0002" },
              ],
              null,
              [{ email: "user3@example.com", phone: "555-0003" }],
            ],
            null,
            [[{ email: "user4@example.com", phone: "555-0004" }, null]],
            [
              [
                { email: "user5@example.com", phone: "555-0005" },
                { email: "user6@example.com", phone: "555-0006" },
              ],
              [
                null,
                { email: "user7@example.com", phone: "555-0007" },
                { email: "user8@example.com", phone: "555-0008" },
                null,
                { email: "user9@example.com", phone: "555-0009" },
              ],
            ],
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(0);
    });

    it("allows fields in different order than query", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              count
              details {
                id
                name
              }
            }
          }
        }
      `);

      // Fixture has fields in different order: count before id, name before id
      const fixtureInput = {
        data: {
          items: [
            {
              count: 5,
              id: "gid://test/Item/1",
              details: {
                name: "Test Item",
                id: "gid://test/ItemDetails/1",
              },
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Order shouldn't matter - we access by key name, not position
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Invalid Fixtures", () => {
    it("should detect null in non-nullable scalar field", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              count
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [{ id: "1", count: null }],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // count is Int! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: 'Expected non-nullable type "Int!" not to be null.',
        path: ["data", "items", 0, "count"],
      });
    });

    it("should detect null in non-nullable array", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              count
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [{ id: "1", count: 10 }, null, { id: "2", count: 20 }],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // items is [Item!]! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Null value found in non-nullable array",
        path: ["data", "items", 1],
      });
    });

    it("should detect null in non-nullable object field", () => {
      const queryAST = parse(`
        query {
          data {
            requiredMetadata {
              email
              phone
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          requiredMetadata: null,
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // requiredMetadata is Metadata! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Expected object, but got null",
        path: ["data", "requiredMetadata"],
      });
    });

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
              id: "gid://test/Item/1",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing expected fixture data for `count`",
        path: ["data", "items", 0, "count"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Missing expected fixture data for `details`",
        path: ["data", "items", 0, "details"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Missing expected fixture data for `metadata`",
        path: ["data", "metadata"],
      });
    });

    it("detects extra fields not in query", () => {
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
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect that 'count' is not in the query
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `count` found in fixture data not in query",
        path: ["data", "items", 0, "count"],
      });
    });

    it("detects extra fields with multiple aliases for the same field", () => {
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
                name: "First Item",
              },
            },
          ],
          secondItems: [
            {
              id: "gid://test/Item/1",
              count: 5,
              details: {
                name: "First Item",
              },
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Each alias is validated independently, so extra fields in each should be detected
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `details` found in fixture data not in query",
        path: ["data", "firstItems", 0, "details"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `count` found in fixture data not in query",
        path: ["data", "secondItems", 0, "count"],
      });
    });

    it("detects extra fields at root level", () => {
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
            },
          ],
        },
        version: "1.0.0", // Real field from schema, but not selected in query
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect the version field since it wasn't selected in the query
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `version` found in fixture data not in query",
        path: ["version"],
      });
    });

    it("detects extra fields with complex nesting, typename aliases, and type discrimination", () => {
      const queryAST = parse(`
        query {
          queryType: __typename
          data {
            searchResults {
              resultType: __typename
              ... on Item {
                id
                details {
                  __typename
                  name
                }
              }
              ... on Metadata {
                email
              }
            }
            interfaceImplementers {
              implType: __typename
              ... on HasId {
                id
              }
              ... on HasName {
                name
              }
            }
            implementersNoType: interfaceImplementers {
              ... on HasId {
                id
              }
            }
            nested {
              nestedType: __typename
              ... on NestedOuterA {
                id
                inner {
                  innerType: __typename
                  ... on NestedInnerA {
                    name
                  }
                  ... on NestedInnerB {
                    value
                  }
                }
              }
              ... on NestedOuterB {
                email
              }
            }
          }
        }
      `);

      const fixtureInput = {
        queryType: "Query",
        extraRootField: "should not be here", // Extra at root
        data: {
          searchResults: [
            {
              resultType: "Item",
              id: "1",
              count: 999, // Extra - count not queried for Item
              details: {
                __typename: "ItemDetails",
                name: "Details",
                extraDetailField: "wrong", // Extra at nested level
              },
            },
            {
              resultType: "Metadata",
              email: "test@example.com",
              phone: "555-1234", // Extra - phone not queried
            },
          ],
          interfaceImplementers: [
            {
              implType: "InterfaceImplementer1",
              id: "impl1",
              name: "First",
              description: "extra", // Extra - description not queried
            },
            {
              implType: "InterfaceImplementer2",
              id: "impl2",
              name: "Second",
              extraField: "also wrong", // Generic extra field
            },
          ],
          implementersNoType: [
            { id: "impl3" }, // Valid - has id from HasId fragment
            {}, // Empty object - valid without __typename (single fragment, union of all fields)
          ],
          nested: [
            {
              nestedType: "NestedOuterA",
              id: "outer1",
              email: "cross-contamination", // Extra - email is from NestedOuterB
              inner: [
                {
                  innerType: "NestedInnerA",
                  name: "Inner",
                  value: "cross-contamination", // Extra - value is from NestedInnerB
                },
              ],
            },
            {
              nestedType: "NestedOuterB",
              email: "outer@example.com",
              id: "cross-contamination", // Extra - id is from NestedOuterA
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect extra fields at all levels with cross-contamination and typename aliases
      // Empty object in implementersNoType is valid (single fragment without __typename - union mode)
      // Errors appear in post-order traversal (deepest to shallowest):
      expect(result.errors).toHaveLength(9);
      expect(result.errors[0]).toStrictEqual({
        message:
          "Extra field `extraDetailField` found in fixture data not in query",
        path: ["data", "searchResults", 0, "details", "extraDetailField"],
      }); // details (deepest)
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `count` found in fixture data not in query",
        path: ["data", "searchResults", 0, "count"],
      }); // Item
      expect(result.errors[2]).toStrictEqual({
        message: "Extra field `phone` found in fixture data not in query",
        path: ["data", "searchResults", 1, "phone"],
      }); // Metadata
      expect(result.errors[3]).toStrictEqual({
        message: "Extra field `description` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 0, "description"],
      }); // InterfaceImplementer1
      expect(result.errors[4]).toStrictEqual({
        message: "Extra field `extraField` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 1, "extraField"],
      }); // InterfaceImplementer2
      expect(result.errors[5]).toStrictEqual({
        message: "Extra field `value` found in fixture data not in query",
        path: ["data", "nested", 0, "inner", 0, "value"],
      }); // NestedInnerA cross-contamination
      expect(result.errors[6]).toStrictEqual({
        message: "Extra field `email` found in fixture data not in query",
        path: ["data", "nested", 0, "email"],
      }); // NestedOuterA cross-contamination
      expect(result.errors[7]).toStrictEqual({
        message: "Extra field `id` found in fixture data not in query",
        path: ["data", "nested", 1, "id"],
      }); // NestedOuterB cross-contamination
      expect(result.errors[8]).toStrictEqual({
        message:
          "Extra field `extraRootField` found in fixture data not in query",
        path: ["extraRootField"],
      }); // root (last)
    });

    it("detects extra fields in union types with inline fragments", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              __typename
              ... on Item {
                id
              }
              ... on Metadata {
                email
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
              count: 5, // Extra field - queried id but not count
            },
            {
              __typename: "Metadata",
              email: "test@example.com",
              phone: "555-0001", // Extra field - queried email but not phone
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect extra fields in both union members
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `count` found in fixture data not in query",
        path: ["data", "searchResults", 0, "count"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `phone` found in fixture data not in query",
        path: ["data", "searchResults", 1, "phone"],
      });
    });

    it("detects fields from wrong fragment type in unions (cross-contamination)", () => {
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
              count: 5,
              email: "item@example.com", // email is only in Metadata fragment
              phone: "555-1234", // phone is only in Metadata fragment
            },
            {
              __typename: "Metadata",
              email: "metadata@example.com",
              phone: "555-5678",
              id: "wrong-id", // id is only in Item fragment
              count: 10, // count is only in Item fragment
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect fields from wrong fragment types
      // Item should NOT have email/phone (those are Metadata fields)
      // Metadata should NOT have id/count (those are Item fields)
      expect(result.errors).toHaveLength(4);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `email` found in fixture data not in query",
        path: ["data", "searchResults", 0, "email"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `phone` found in fixture data not in query",
        path: ["data", "searchResults", 0, "phone"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Extra field `id` found in fixture data not in query",
        path: ["data", "searchResults", 1, "id"],
      });
      expect(result.errors[3]).toStrictEqual({
        message: "Extra field `count` found in fixture data not in query",
        path: ["data", "searchResults", 1, "count"],
      });
    });

    it("detects extra fields in interface fragments with type discrimination", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              __typename
              ... on HasId {
                id
              }
              ... on HasName {
                name
              }
              ... on HasDescription {
                description
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              __typename: "InterfaceImplementer1", // Implements HasId, HasName, HasDescription
              id: "1",
              name: "First",
              description: "Desc",
              extraField1: "should not be here", // Extra field
            },
            {
              __typename: "InterfaceImplementer2", // Implements HasId, HasName only
              id: "2",
              name: "Second",
              description: "Wrong!", // Does NOT implement HasDescription
              extraField2: "also wrong",
            },
            {
              __typename: "InterfaceImplementer3", // Implements HasId only
              id: "3",
              name: "Wrong!", // Does NOT implement HasName
              description: "Wrong!", // Does NOT implement HasDescription
              extraField3: "also wrong",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect:
      // - extraField1 on InterfaceImplementer1 (implements all interfaces, but field not in query)
      // - description and extraField2 on InterfaceImplementer2 (doesn't implement HasDescription)
      // - name, description, and extraField3 on InterfaceImplementer3 (doesn't implement HasName or HasDescription)
      expect(result.errors).toHaveLength(6);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `extraField1` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 0, "extraField1"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `description` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 1, "description"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Extra field `extraField2` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 1, "extraField2"],
      });
      expect(result.errors[3]).toStrictEqual({
        message: "Extra field `name` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 2, "name"],
      });
      expect(result.errors[4]).toStrictEqual({
        message: "Extra field `description` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 2, "description"],
      });
      expect(result.errors[5]).toStrictEqual({
        message: "Extra field `extraField3` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 2, "extraField3"],
      });
    });

    it("detects extra fields in truly nested inline fragments (fragment within fragment)", () => {
      const queryAST = parse(`
        query {
          data {
            nested {
              __typename
              ... on NestedOuterA {
                id
                inner {
                  __typename
                  ... on NestedInnerA {
                    name
                  }
                  ... on NestedInnerB {
                    value
                  }
                }
              }
              ... on NestedOuterB {
                email
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          nested: [
            {
              __typename: "NestedOuterA",
              id: "1",
              email: "wrongField", // email is from NestedOuterB, not NestedOuterA
              inner: [
                {
                  __typename: "NestedInnerA",
                  name: "Inner name",
                  value: "wrongField", // value is from NestedInnerB, not NestedInnerA
                },
              ],
            },
            {
              __typename: "NestedOuterB",
              email: "outer@example.com",
              id: "wrongField", // id is from NestedOuterA, not NestedOuterB
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect:
      // - value on NestedInnerA (nested level validated first)
      // - email on NestedOuterA (outer level)
      // - id on NestedOuterB (outer level)
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `value` found in fixture data not in query",
        path: ["data", "nested", 0, "inner", 0, "value"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `email` found in fixture data not in query",
        path: ["data", "nested", 0, "email"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Extra field `id` found in fixture data not in query",
        path: ["data", "nested", 1, "id"],
      });
    });

    it("detects extra fields in nested inline fragments on concrete union types", () => {
      const queryAST = parse(`
        query {
          data {
            interfaceImplementers {
              __typename
              ... on InterfaceImplementer1 {
                id
                name
              }
              ... on InterfaceImplementer2 {
                id
              }
              ... on InterfaceImplementer3 {
                id
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          interfaceImplementers: [
            {
              __typename: "InterfaceImplementer1",
              id: "1",
              name: "First",
              description: "extra field", // Not queried for InterfaceImplementer1
              extraField1: "should not be here",
            },
            {
              __typename: "InterfaceImplementer2",
              id: "2",
              name: "Wrong!", // InterfaceImplementer2 fragment only queries id
              extraField2: "also wrong",
            },
            {
              __typename: "InterfaceImplementer3",
              id: "3",
              name: "Wrong!", // InterfaceImplementer3 fragment only queries id
              description: "also wrong",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect:
      // - description and extraField1 on InterfaceImplementer1 (only id, name queried)
      // - name and extraField2 on InterfaceImplementer2 (only id queried)
      // - name and description on InterfaceImplementer3 (only id queried)
      expect(result.errors).toHaveLength(6);
      expect(result.errors[0]).toStrictEqual({
        message: "Extra field `description` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 0, "description"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Extra field `extraField1` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 0, "extraField1"],
      });
      expect(result.errors[2]).toStrictEqual({
        message: "Extra field `name` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 1, "name"],
      });
      expect(result.errors[3]).toStrictEqual({
        message: "Extra field `extraField2` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 1, "extraField2"],
      });
      expect(result.errors[4]).toStrictEqual({
        message: "Extra field `name` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 2, "name"],
      });
      expect(result.errors[5]).toStrictEqual({
        message: "Extra field `description` found in fixture data not in query",
        path: ["data", "interfaceImplementers", 2, "description"],
      });
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
        data: "this should be an object, not a string",
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Expected object, but got string",
        path: ["data"],
      });
    });

    it("detects invalid scalar values", () => {
      const queryAST = parse(`
        query Query {
          data {
            items {
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
              id: 123,
              count: "not a number",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: 'Int cannot represent non-integer value: "not a number"',
        path: ["data", "items", 0, "count"],
      });
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
          items: [],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing expected fixture data for `metadata`",
        path: ["data", "metadata"],
      });
    });

    it("should detect incorrect array nesting depth", () => {
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

      // Schema says itemMatrix: [[Item]] (double nested)
      // But fixture provides [Item, Item] (single nested) - wrong!
      const fixtureInput = {
        data: {
          itemMatrix: [
            { id: "1", count: 10 },
            { id: "2", count: 20 },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect that we got objects where we expected arrays
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toStrictEqual({
        message: "Expected array, but got object",
        path: ["data", "itemMatrix", 0],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Expected array, but got object",
        path: ["data", "itemMatrix", 1],
      });
    });

    it("should detect non-array value where array is expected", () => {
      const queryAST = parse(`
        query {
          data {
            items {
              id
              count
            }
          }
        }
      `);

      // Schema expects items: [Item!]! (an array)
      // But fixture provides a single object instead
      const fixtureInput = {
        data: {
          items: { id: "1", count: 10 },
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect that we got an object where we expected an array
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Expected array, but got object",
        path: ["data", "items"],
      });
    });

    it("detects fields with missing type information", () => {
      // Query references a field that doesn't exist in the schema
      const queryAST = parse(`
        query {
          data {
            items {
              id
              nonExistentField
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          items: [
            {
              id: "gid://test/Item/1",
              nonExistentField: "some value",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect missing type information for the invalid field
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Cannot validate `nonExistentField`: missing field definition",
        path: ["data", "items", "nonExistentField"],
      });
    });

    it("detects empty objects in non-union context", () => {
      const queryAST = parse(`
        query {
          data {
            items {
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
              count: 5,
            },
            {}, // Empty object in non-union context - should error
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is invalid in non-union context - missing required fields
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing expected fixture data for `id`",
        path: ["data", "items", 1, "id"],
      });
      expect(result.errors[1]).toStrictEqual({
        message: "Missing expected fixture data for `count`",
        path: ["data", "items", 1, "count"],
      });
    });

    it("detects empty objects when inline fragment is on same type as field", () => {
      const queryAST = parse(`
        query {
          data {
            purchasable {
              ... on Purchasable {
                price
              }
            }
          }
        }
      `);

      const fixtureInput = {
        data: {
          purchasable: {}, // Empty object when selecting on interface itself - should error
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is invalid when inline fragment is on the same type as the field
      // We're not discriminating between union members, so all fields are required
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing expected fixture data for `price`",
        path: ["data", "purchasable", "price"],
      });
    });

    it("handles multiple inline fragments on same type without typename", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
              ... on Item {
                id
              }
              ... on Item {
                count
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
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Multiple fragments but all on the same type (Item)
      // Still errors on missing __typename because fragmentSpreadCount > 1
      // However, NO cascading field errors because all fragments select on same type
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing `__typename` field for abstract type `SearchResult`",
        path: ["data", "searchResults"],
      });
    });

    it("detects missing fields when __typename is not selected in union with inline fragments", () => {
      const queryAST = parse(`
        query {
          data {
            searchResults {
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
              id: "gid://test/Item/1",
              count: 5,
            },
            {
              email: "test@example.com",
              phone: "555-0001",
            },
          ],
        },
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Without __typename, we can't discriminate which fields are expected for each object
      // Validator detects missing __typename for abstract type with 2+ fragments and BREAKs early
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toStrictEqual({
        message: "Missing `__typename` field for abstract type `SearchResult`",
        path: ["data", "searchResults"],
      });
    });
  });
});

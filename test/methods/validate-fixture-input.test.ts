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
    it("validates default fixture", async () => {
      const queryAST = await loadInputQuery("./test/fixtures/valid-query.graphql");
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
              count: 5
            },
            {
              type: "Metadata",
              email: "test@example.com",
              phone: "555-0001"
            }
          ]
        }
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
                  name: "Inner name"
                  // No __typename - query doesn't select it for inner
                }
              ]
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // - inner SelectionSet has typenameResponseKey = undefined (doesn't inherit "outerType")
      // - Detects missing __typename and BREAKs early
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Missing __typename field for abstract type NestedInner");
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
                  name: "Inner name"
                }
              ]
            }
          ]
        }
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
              currency: "USD"
            },
            {
              __typename: "DigitalProduct",
              price: 500,
              currency: "USD"
            },
            {
              __typename: "GiftCard",
              code: "GIFT123",
              balance: 5000
            }
          ]
        }
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
              count: 5
            }
          ]
        }
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
              count: 5
            },
            {}  // Empty object - represents Metadata that didn't match the Item fragment
          ]
        }
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
              currency: "USD"
            },
            {}  // Empty object - GiftCard that doesn't implement Purchasable
          ]
        }
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
              description: "Has all three interfaces"
            },
            {
              id: "2",
              name: "Implementer2",
              description: "Also has all three"
            },
            {}
            // Empty object - NoInterfacesImplemented that doesn't implement any interface
            // Valid because InterfaceImplementersUnion {1,2,3,4} was narrowed to HasId {1,2,3}
          ]
        }
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
              description: "Implementer1 - implements all three"
            },
            {},
            {},
            {}
            // Three empty objects representing Implementer2, 3, 4 that don't implement HasDescription
          ]
        }
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
              description: "Implements all three"
            },
            {
              __typename: "InterfaceImplementer2",
              id: "2",
              name: "Implementer2"
              // Implements HasId & HasName, but not HasDescription
            },
            {
              __typename: "InterfaceImplementer3",
              id: "3"
              // Implements HasId only
            },
            {
              __typename: "NoInterfacesImplemented"
              // Doesn't implement any interface
            }
          ]
        }
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
              description: "Implements all three"
            },
            {
              id: "2",
              name: "Implementer2"
              // InterfaceImplementer2: implements HasId & HasName, but not HasDescription
              // This is a valid response - nested fragment doesn't match
            },
            {
              id: "3"
              // InterfaceImplementer3: implements HasId only
              // This is a valid response - nested fragments don't match
            },
            {}
            // NoInterfacesImplemented: doesn't implement any interface
            // Empty object is valid - handled by empty object logic
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Without __typename, validator cannot determine if missing fields are valid
      // (due to type not implementing nested interfaces) or invalid (incomplete data)
      // So it conservatively expects all selected fields on non-empty objects
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toBe("Missing expected fixture data for name");
      expect(result.errors[1]).toBe("Missing expected fixture data for description");
      expect(result.errors[2]).toBe("Missing expected fixture data for description");
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
              count: 5
            },
            {
              __typename: "Metadata"  // Only typename, no other fields
            }
          ]
        }
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
              null,
              { id: "2", count: 20 }
            ],
            null,
            [
              { id: "3", count: 30 },
              { id: "4", count: 40 },
              null,
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
                    { key: "size", value: "large" }
                  ]
                }
              },
              {
                id: "gid://test/Item/2",
                count: 20,
                details: {
                  id: "gid://test/ItemDetails/2",
                  name: "Another Item",
                  attributes: null
                }
              }
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
                    { key: "weight", value: "heavy" }
                  ]
                }
              },
              null,
              {
                id: "gid://test/Item/4",
                count: 40,
                details: {
                  id: "gid://test/ItemDetails/4",
                  name: "Fourth Item",
                  attributes: null
                }
              }
            ]
          ]
        }
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
              details: null
            }
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
                null,
                { email: "user2@example.com", phone: "555-0002" }
              ],
              null,
              [
                { email: "user3@example.com", phone: "555-0003" }
              ]
            ],
            null,
            [
              [
                { email: "user4@example.com", phone: "555-0004" },
                null
              ]
            ],
            [
              [
                { email: "user5@example.com", phone: "555-0005" },
                { email: "user6@example.com", phone: "555-0006" }
              ],
              [
                null,
                { email: "user7@example.com", phone: "555-0007" },
                { email: "user8@example.com", phone: "555-0008" },
                null,
                { email: "user9@example.com", phone: "555-0009" }
              ]
            ]
          ]
        }
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
                id: "gid://test/ItemDetails/1"
              }
            }
          ]
        }
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
          items: [
            { id: "1", count: null }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // count is Int! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Expected non-nullable type "Int!" not to be null. At ""');
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
          items: [
            { id: "1", count: 10 },
            null,
            { id: "2", count: 20 }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // items is [Item!]! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Null value found in non-nullable array at items[1]');
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
          requiredMetadata: null
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // requiredMetadata is Metadata! so null should not be allowed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Expected object for requiredMetadata, but got null");
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
              id: "gid://test/Item/1"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);
      expect(result.errors).toHaveLength(3);
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

      // When implemented, should detect that 'count' is not in the query
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('count');
      expect(result.errors[0]).toContain('not in query');
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
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Expected object for data, but got string");
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
              count: "not a number"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe(
        'Int cannot represent non-integer value: "not a number" At ""'
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
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe(
        "Missing expected fixture data for metadata"
      );
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
            { id: "2", count: 20 }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect that we got objects where we expected arrays
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toBe('Expected array at itemMatrix[0], but got object');
      expect(result.errors[1]).toBe('Expected array at itemMatrix[1], but got object');
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
          items: { id: "1", count: 10 }
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect that we got an object where we expected an array
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Expected array for items, but got object');
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
              nonExistentField: "some value"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Should detect missing type information for the invalid field
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Cannot validate nonExistentField: missing field definition');
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
              count: 5
            },
            {}  // Empty object in non-union context - should error
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is invalid in non-union context - missing required fields
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toBe("Missing expected fixture data for id");
      expect(result.errors[1]).toBe("Missing expected fixture data for count");
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
          purchasable: {}  // Empty object when selecting on interface itself - should error
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Empty object {} is invalid when inline fragment is on the same type as the field
      // We're not discriminating between union members, so all fields are required
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Missing expected fixture data for price");
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
              count: 5
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Multiple fragments but all on the same type (Item)
      // Still errors on missing __typename because fragmentSpreadCount > 1
      // However, NO cascading field errors because all fragments select on same type
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Missing __typename field for abstract type SearchResult");
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
              count: 5
            },
            {
              email: "test@example.com",
              phone: "555-0001"
            }
          ]
        }
      };

      const result = validateFixtureInput(queryAST, schema, fixtureInput);

      // Without __typename, we can't discriminate which fields are expected for each object
      // Validator detects missing __typename for abstract type with 2+ fragments and BREAKs early
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Missing __typename field for abstract type SearchResult");
    });
  });
});

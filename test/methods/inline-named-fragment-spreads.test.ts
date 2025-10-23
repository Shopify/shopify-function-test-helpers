import { describe, it, expect } from "vitest";
import { parse, print } from "graphql/language";
import { inlineNamedFragmentSpreads } from "../../src/utils/inline-named-fragment-spreads.js";

describe("inlineNamedFragmentSpreads", () => {
  it("should no-op when there aren't any named fragment spreads", async () => {
    const query = `{
  user {
    name
  }
}`;

    const ast = parse(query);
    const result = inlineNamedFragmentSpreads(ast);
    const printedResult = print(result);
    expect(printedResult).toEqual(query);
  }, 20000); // 10 second timeout for build operations

  it("should inline named fragment spreads", async () => {
    const query = `
    query {
      user {
        ...UserFragment
      }
    }

    fragment UserFragment on User {
      name
    }
    `;

    const expectedQuery = `{
  user {
    ... on User {
      name
    }
  }
}`;

    const ast = parse(query);
    const result = inlineNamedFragmentSpreads(ast);
    const printedResult = print(result);
    expect(printedResult).toEqual(expectedQuery);
  });

  it("should inline nested named fragment spreads", async () => {
    const query = `
    query {
      user {
        ...UserFragment
      }
    }

    fragment UserFragment on User {
      name
      address {
        ...UserAddressFragment
      }
    }

    fragment UserAddressFragment on UserAddress {
      address1
    }
    `;

    const expectedQuery = `{
  user {
    ... on User {
      name
      address {
        ... on UserAddress {
          address1
        }
      }
    }
  }
}`;

    const ast = parse(query);
    const result = inlineNamedFragmentSpreads(ast);
    const printedResult = print(result);
    expect(printedResult).toEqual(expectedQuery);
  });
});

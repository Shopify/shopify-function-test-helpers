import { describe, it, expect } from "vitest";
import { visitQuery } from "../../src/methods/adams-visitor.ts";

describe("visitQuery", () => {
  it("should do something", async () => {
    visitQuery(
      "query { user { ...UserFragment } user1: user { ...UserFragment } } fragment UserFragment on User { name }",
      "type User { name: String } type Query { user: User }",
      { user: { name: "John Doe" }, user1: { name: "Jane Doe" } }
    );
  }, 20000); // 10 second timeout for build operations

  it("handles arrays", async () => {
    visitQuery(
      "query { users { name integers } }",
      "type User { name: String, integers: [Int] } type Query { users: [User] }",
      { users: [{ name: "John Doe", integers: [1, 2, 3] }, { name: "Jane Doe", integers: [4, 5, null] }] }
    );
  }, 20000); // 10 second timeout for build operations
});

import {
  DocumentNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  visit,
  Kind,
} from "graphql";

/**
 * Transforms a GraphQL document by replacing all named fragment spreads with inline fragments.
 *
 * @param document - The GraphQL document containing fragment definitions and spreads
 * @returns A new document with all fragment spreads inlined and fragment definitions removed
 *
 * @throws {Error} If a fragment spread references a fragment definition that doesn't exist
 */
export function inlineNamedFragmentSpreads(
  document: DocumentNode
): DocumentNode {
  return visit(document, {
    FragmentSpread: {
      enter(node) {
        const name = node.name.value;
        const fragmentDefinition: FragmentDefinitionNode | undefined =
          document.definitions.find(
            (def) =>
              def.kind === "FragmentDefinition" && def.name.value === name
          ) as FragmentDefinitionNode | undefined;
        if (!fragmentDefinition) {
          throw new Error(`Fragment definition not found: ${name}`);
        }
        const inlineFragment: InlineFragmentNode = {
          kind: Kind.INLINE_FRAGMENT,
          selectionSet: fragmentDefinition.selectionSet,
          typeCondition: fragmentDefinition.typeCondition,
        };
        return inlineFragment;
      },
    },
    FragmentDefinition: {
      enter() {
        // Remove fragment definitions since we have inlined them
        return null;
      },
    },
  });
}

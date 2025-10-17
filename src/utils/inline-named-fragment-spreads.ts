import {
  DocumentNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  visit,
  Kind,
} from "graphql";

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
        return null;
      },
    },
  });
}

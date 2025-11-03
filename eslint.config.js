import shopifyPlugin from '@shopify/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'test-app/**'],
  },
  ...shopifyPlugin.configs.typescript,
  ...shopifyPlugin.configs.prettier,
  {
    rules: {
      // This library doesn't use component boundaries
      '@shopify/strict-component-boundaries': 'off',
      // Allow file extensions in imports (standard for ES modules)
      'import-x/extensions': 'off',
      // Allow inline comments
      'line-comment-position': 'off',
      // Allow buildSchema (not just buildClientSchema)
      '@shopify/typescript-prefer-build-client-schema': 'off',
      // Allow process.env for spawning child processes with correct PATH
      'no-process-env': 'off',
    },
  },
];

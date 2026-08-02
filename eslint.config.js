const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  ...expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  {
    ignores: ['.expo/**', 'dist/**', 'web-build/**', 'node_modules/**'],
  },
]);

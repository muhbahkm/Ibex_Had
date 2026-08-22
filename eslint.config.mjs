import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      '.expo/**',
      'coverage/**',
      'eslint.config.mjs',
      'apps/mobile/metro.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['apps/mobile/src/lib/preview-ibex.ts'],
    rules: {
      // The preview adapter intentionally fulfills the same async application contract
      // with synchronous in-memory data. Keeping Promise-returning methods preserves
      // channel parity without adding artificial awaits or touching Supabase.
      '@typescript-eslint/require-await': 'off',
    },
  },
);

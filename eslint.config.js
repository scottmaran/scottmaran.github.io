import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'knowledge/**', 'assets/**'] },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },
];

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'assets/nhlpa93_94_sprites/**', 'assets/nhlpa93_tunes_mp3/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      'no-console': 'off'
    }
  }
];

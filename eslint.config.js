'use strict';
// ponytail: package.json has no "type" field (defaults to CommonJS) — require() is intentional here
const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    // web/ tarayıcı-tarafı JSX dosyaları ve vendor içerir — ayrı ortam, Node linti dışı
    ignores: ['web/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // _ önekli değişkenler ve catch parametreleri kasıtlı unused olabilir
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  prettierConfig,
];

'use strict';
// ponytail: package.json has no "type" field (defaults to CommonJS) — require() is intentional here
const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');
const babelParser = require('@babel/eslint-parser');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  {
    // .context/ holds orchestrator artifacts (agent-run workflow specs whose
    // bodies execute inside an injected async wrapper with injected globals).
    // They are not importable source modules, so they are not linted as such.
    // docs/old/ holds archived sprint docs (e.g. workflow-spec JS snippets), not source.
    ignores: ['web/vendor/**', 'node_modules/**', '.context/**', 'docs/old/**'],
  },
  // Node files (server, lib, bin, mcp-server, hooks, test)
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ignores: ['web/**'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // _ önekli değişkenler ve catch parametreleri kasıtlı unused olabilir
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // ponytail: empty catch blocks silently swallow errors — enforce explicit handling
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  // Browser-side web/ files — JSX + React hooks enforcement
  {
    files: ['web/**/*.js'],
    ignores: ['web/vendor/**'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-react'],
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // ponytail: empty catch blocks silently swallow errors — enforce explicit handling
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  prettierConfig,
];

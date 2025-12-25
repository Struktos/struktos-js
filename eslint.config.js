// ============================================================================
// Struktos.js ADaaS Platform - ESLint Configuration (Flat Config)
// ============================================================================
//
// 🎯 Purpose:
// Defines the "Struktos Constitution" - a comprehensive set of linting rules
// that enforce code quality, consistency, and architectural integrity across
// the entire monorepo.
//
// 🏛️ ADaaS Vision Alignment:
// - Consistent code style across 1,000+ file projects
// - Automated enforcement of best practices
// - Zero-tolerance for common anti-patterns
//
// 📐 Hexagonal Architecture Enforcement:
// - Import order reflects architectural layers
// - Circular dependency prevention
// - Domain isolation rules
//
// ============================================================================

import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  // ─────────────────────────────────────────────────────────────────────────
  // Global Ignores
  // Files and directories excluded from all linting
  // ─────────────────────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/generated/**',
      '**/*.d.ts',
      '**/vitest.config.ts',
      '**/tsup.config.ts',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Base JavaScript Configuration
  // ─────────────────────────────────────────────────────────────────────────
  eslint.configs.recommended,

  // ─────────────────────────────────────────────────────────────────────────
  // TypeScript Configuration
  // Strict rules for enterprise-grade type safety
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // ─────────────────────────────────────────────────────────────────────
      // TypeScript Strict Rules
      // ─────────────────────────────────────────────────────────────────────
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        // Interfaces MUST start with 'I' (Struktos Convention)
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['I'],
        },
        // Type aliases use PascalCase
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        // Enums use PascalCase
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        // Enum members use PascalCase or UPPER_CASE
        {
          selector: 'enumMember',
          format: ['PascalCase', 'UPPER_CASE'],
        },
        // Classes use PascalCase
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        // Variables use camelCase or UPPER_CASE for constants
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        // Functions use camelCase
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        // Parameters use camelCase
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Properties use camelCase
        {
          selector: 'property',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
      ],

      // ─────────────────────────────────────────────────────────────────────
      // Import Rules - Hexagonal Architecture Layer Enforcement
      // ─────────────────────────────────────────────────────────────────────
      'import/order': [
        'error',
        {
          groups: [
            'builtin', // Node.js built-ins
            'external', // npm packages
            'internal', // @struktos/* packages
            'parent', // Parent directories
            'sibling', // Same directory
            'index', // Index files
            'type', // Type imports
          ],
          pathGroups: [
            // Infrastructure layer imports LAST within internal
            {
              pattern: '@struktos/core/infrastructure/**',
              group: 'internal',
              position: 'after',
            },
            // Application layer imports in middle
            {
              pattern: '@struktos/core/application/**',
              group: 'internal',
              position: 'after',
            },
            // Domain layer imports FIRST within internal
            {
              pattern: '@struktos/core/domain/**',
              group: 'internal',
              position: 'before',
            },
            // All @struktos packages
            {
              pattern: '@struktos/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-self-import': 'error',
      'import/no-duplicates': 'error',

      // ─────────────────────────────────────────────────────────────────────
      // General Best Practices
      // ─────────────────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // Disable base rules that conflict with TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Test Files Configuration
  // Relaxed rules for test files
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration Files
  // Rules for config files (ESLint, Vitest, etc.)
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['*.config.ts', '*.config.js', '*.config.mjs'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Prettier Integration
  // Disables formatting rules that conflict with Prettier
  // ─────────────────────────────────────────────────────────────────────────
  prettier,
];

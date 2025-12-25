// ============================================================================
// Struktos.js ADaaS Platform - Vitest Workspace Configuration
// ============================================================================
//
// 🎯 Purpose:
// Configures Vitest as the high-performance test runner for the entire
// monorepo. Enables ESM support, parallel execution, and unified reporting.
//
// 🏛️ ADaaS Vision Alignment:
// - Blazing fast test execution (esbuild-powered)
// - Native ESM support (no transpilation overhead)
// - Unified coverage reporting across all packages
//
// 📐 Hexagonal Architecture Testing Strategy:
// - Unit tests: Domain and Application layers (isolated)
// - Integration tests: Infrastructure adapters (with real/mock dependencies)
// - E2E tests: Full application flow (apps/)
//
// CLI Commands:
// - Run all: pnpm test
// - Watch mode: pnpm test:watch
// - Coverage: pnpm test:coverage
// - Specific package: pnpm test --filter=@struktos/core
//
// ============================================================================

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // ─────────────────────────────────────────────────────────────────────────
  // Packages Configuration
  // Each package has its own test configuration for isolation
  // ─────────────────────────────────────────────────────────────────────────
  'packages/*/vitest.config.ts',

  // ─────────────────────────────────────────────────────────────────────────
  // Applications Configuration
  // Apps may have different testing requirements (e.g., E2E)
  // ─────────────────────────────────────────────────────────────────────────
  'apps/*/vitest.config.ts',
]);

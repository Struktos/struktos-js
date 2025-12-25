/**
 * @fileoverview Vitest Test Setup
 *
 * Global test configuration and utilities for @struktos/core.
 * This file is loaded before each test file runs.
 *
 * @license Apache-2.0
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// ============================================================================
// Global Test Setup
// ============================================================================

beforeAll(() => {
  console.info('[Test Setup] Starting @struktos/core tests');
});

afterAll(() => {
  console.info('[Test Setup] Completed @struktos/core tests');
});

// ============================================================================
// Per-Test Cleanup
// ============================================================================

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

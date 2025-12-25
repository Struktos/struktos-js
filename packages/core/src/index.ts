/**
 * @fileoverview @struktos/core - Main Entry Point
 *
 * Struktos.js Core Framework
 * Enterprise-grade Node.js framework with Hexagonal Architecture,
 * DDD, CQRS, and Unit of Work patterns.
 *
 * @packageDocumentation
 * @module @struktos/core
 * @version 1.0.0-alpha.1
 * @license Apache-2.0
 *
 * @example
 * ```typescript
 * import { createApp, IUnitOfWork, ICommand } from '@struktos/core';
 *
 * const app = createApp();
 * await app.start();
 * ```
 */

// ============================================================================
// Domain Layer Exports
// Pure business logic - NO external dependencies
// ============================================================================
export type * from './domain';

// ============================================================================
// Application Layer Exports
// Use case orchestration, CQRS, DI
// ============================================================================
export type * from './application';

// ============================================================================
// Infrastructure Layer Exports
// External concerns, adapters, middleware
// ============================================================================
export type * from './infrastructure';

// ============================================================================
// Common Exports
// Shared types, utilities, constants
// ============================================================================
export type * from './common';

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.0-alpha.1';

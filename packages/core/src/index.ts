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
 * import {
 *   RequestContext,
 *   ContextKey,
 *   TRACE_ID_KEY,
 * } from '@struktos/core';
 *
 * // Define custom keys
 * const USER_ID = new ContextKey<number>('userId');
 *
 * // Create context scope
 * RequestContext.run({ traceId: 'abc-123' }, async () => {
 *   const ctx = RequestContext.current();
 *   ctx?.set(USER_ID, 42);
 *   console.log(ctx?.get(TRACE_ID_KEY)); // 'abc-123'
 * });
 * ```
 */

// ============================================================================
// Domain Layer Exports
// Pure business logic - NO external dependencies
// ============================================================================
//export * from './domain';

// ============================================================================
// Application Layer Exports
// Use case orchestration, CQRS, DI
// ============================================================================
//export * from './application';

// ============================================================================
// Infrastructure Layer Exports
// External concerns, adapters, middleware
// ============================================================================
//export * from './infrastructure';

// ============================================================================
// Common Exports
// Shared types, utilities, constants
// ============================================================================
//export * from './common';

// ============================================================================
// Convenience Re-exports (Most commonly used)
// ============================================================================

// Context - Most important for day-to-day usage
export {
  ContextKey,
  TRACE_ID_KEY,
  REQUEST_ID_KEY,
  USER_ID_KEY,
  TIMESTAMP_KEY,
  type IContext,
  type IContextProvider,
  type IStruktosContextData,
} from './domain/context';

export {
  RequestContext,
  RequestContextProvider,
  RequestContextProxy,
  getCurrentContext,
  requireContext,
} from './infrastructure/context';

export {
  AutoContextBehavior,
  type IPipelineBehavior,
  type IHandlerContext,
} from './application/context';

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.0-alpha.1';

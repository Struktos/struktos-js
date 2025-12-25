/**
 * @fileoverview Domain Context Module Exports
 *
 * @packageDocumentation
 * @module @struktos/core/domain/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module exports context-related interfaces and types that are
 * technology-agnostic. The actual AsyncLocalStorage implementation
 * lives in the Infrastructure layer.
 *
 * ## What's Exported
 *
 * - **ContextKey<T>**: Type-safe context key class
 * - **IContext**: Core context interface
 * - **IContextProvider**: Context factory interface
 * - **Pre-defined Keys**: TRACE_ID_KEY, USER_ID_KEY, etc.
 *
 * @example
 * ```typescript
 * import {
 *   ContextKey,
 *   IContext,
 *   TRACE_ID_KEY,
 * } from '@struktos/core/domain/context';
 *
 * // Define custom keys
 * const TENANT_ID = new ContextKey<string>('tenantId');
 *
 * // Use in service
 * function processRequest(ctx: IContext) {
 *   const traceId = ctx.get(TRACE_ID_KEY);
 *   const tenantId = ctx.get(TENANT_ID);
 * }
 * ```
 */

// ============================================================================
// ContextKey - Type-Safe Context Keys
// ============================================================================

export {
  ContextKey,
  type ContextKeyValue,
  type ContextKeyType,
  // Pre-defined keys
  TRACE_ID_KEY,
  REQUEST_ID_KEY,
  USER_ID_KEY,
  TIMESTAMP_KEY,
  CANCELLED_KEY,
} from './context-key';

// ============================================================================
// IContext - Context Interface
// ============================================================================

export {
  type IContext,
  type IContextProvider,
  type IStruktosContextData,
  type CancelCallback,
  CONTEXT_PROVIDER_TOKEN,
} from './context.interface';

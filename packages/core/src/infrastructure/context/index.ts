/**
 * @fileoverview Infrastructure Context Module Exports
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module exports the concrete AsyncLocalStorage-based implementation
 * of the context system. It provides:
 *
 * - **RequestContext**: The main context class (ALS-based)
 * - **RequestContextProxy**: Lazy-loading proxy wrapper
 * - **RequestContextProvider**: IContextProvider implementation
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   RequestContext,
 *   RequestContextProxy,
 *   getCurrentContext,
 * } from '@struktos/core/infrastructure/context';
 *
 * // Create context scope
 * RequestContext.run({ traceId: 'abc' }, async () => {
 *   // Access context
 *   const ctx = getCurrentContext();
 *   console.log(ctx?.get(TRACE_ID_KEY));
 * });
 *
 * // Or use lazy proxy
 * const lazyCtx = RequestContextProxy.lazy();
 * // ... context resolved only when accessed
 * ```
 */

// ============================================================================
// RequestContext - AsyncLocalStorage Implementation
// ============================================================================

export {
  RequestContext,
  RequestContextProvider,
  getCurrentContext,
  requireContext,
} from './request-context';

// ============================================================================
// RequestContextProxy - Lazy Loading
// ============================================================================

export { RequestContextProxy, type IContextProxyOptions } from './context-proxy';

// ============================================================================
// Internal (for testing and advanced use)
// ============================================================================

export {
  type IContextStore,
  createContextStore,
  cloneContextStore,
  storeToObject,
  resolveKeyId,
} from './context-store';

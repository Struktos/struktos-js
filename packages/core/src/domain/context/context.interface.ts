/**
 * @fileoverview IContext - Context Interface Abstraction
 *
 * @packageDocumentation
 * @module @struktos/core/domain/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN (Core)
 *
 * This interface defines the contract for context management without
 * specifying HOW context is stored or propagated. The actual implementation
 * (AsyncLocalStorage) lives in the Infrastructure layer.
 *
 * ## Dependency Rule Compliance
 *
 * ```
 * Domain Layer (this file)
 *     ↑ depends on nothing external
 *     |
 * Application Layer
 *     ↑ depends on Domain interfaces
 *     |
 * Infrastructure Layer
 *     ↑ implements Domain interfaces
 * ```
 *
 * @version 1.0.0
 */

import { type ContextKey } from './context-key';

/**
 * Standard context data interface for Struktos.js applications.
 *
 * @remarks
 * This interface defines the commonly used context fields that are
 * automatically populated by Struktos.js adapters and middleware.
 *
 * You can extend this interface for application-specific needs:
 *
 * ```typescript
 * interface MyContextData extends IStruktosContextData {
 *   tenantId: string;
 *   locale: string;
 * }
 * ```
 */
export interface IStruktosContextData {
  /** Distributed tracing correlation ID */
  traceId?: string;

  /** Unique identifier for this specific request */
  requestId?: string;

  /** Authenticated user identifier */
  userId?: string;

  /** Request start timestamp (epoch milliseconds) */
  timestamp?: number;

  /** Additional custom properties */
  [key: string]: unknown;
}

/**
 * Cancellation callback function type.
 * Called when context is cancelled.
 */
export type CancelCallback = () => void | Promise<void>;

/**
 * IContext - Core context interface for request lifecycle management.
 *
 * @template TData - Type of context data, defaults to IStruktosContextData
 *
 * @remarks
 * **Design Philosophy:**
 *
 * This interface provides two access patterns:
 *
 * 1. **Type-Safe Access (Recommended)**: Using ContextKey<T>
 *    ```typescript
 *    const USER_ID = new ContextKey<string>('userId');
 *    ctx.get(USER_ID);  // Type: string | undefined
 *    ```
 *
 * 2. **String Key Access (Legacy)**: Using string keys with TData
 *    ```typescript
 *    ctx.get('userId');  // Type: TData['userId']
 *    ```
 *
 * **Cancellation Support:**
 *
 * Context supports cooperative cancellation through:
 * - `isCancelled()`: Check if cancelled
 * - `cancel()`: Trigger cancellation
 * - `onCancel(callback)`: Register cleanup handlers
 *
 * @example Type-safe access with ContextKey
 * ```typescript
 * import { ContextKey, IContext } from '@struktos/core';
 *
 * const TRACE_ID = new ContextKey<string>('traceId');
 * const USER_ID = new ContextKey<number>('userId');
 *
 * function logOperation(ctx: IContext) {
 *   const traceId = ctx.get(TRACE_ID);  // string | undefined
 *   const userId = ctx.get(USER_ID);    // number | undefined
 *   console.log({ traceId, userId });
 * }
 * ```
 *
 * @example String key access (legacy compatibility)
 * ```typescript
 * interface MyContextData extends IStruktosContextData {
 *   customField: string;
 * }
 *
 * function handler(ctx: IContext<MyContextData>) {
 *   const custom = ctx.get('customField');  // string | undefined
 * }
 * ```
 */
export interface IContext<TData extends IStruktosContextData = IStruktosContextData> {
  // ============================================================================
  // Type-Safe Access (ContextKey<T>)
  // ============================================================================

  /**
   * Get a value from context using a type-safe ContextKey.
   *
   * @template T - Value type (inferred from key)
   * @param key - ContextKey to look up
   * @returns The value, defaultValue if not found, or undefined
   *
   * @example
   * ```typescript
   * const TIMEOUT = new ContextKey<number>('timeout', { defaultValue: 5000 });
   * const timeout = ctx.get(TIMEOUT); // number (5000 if not set)
   * ```
   */
  get<T>(key: ContextKey<T>): T | undefined;

  /**
   * Get a value from context using a string key (legacy).
   *
   * @template K - Key type from TData
   * @param key - String key to look up
   * @returns The value or undefined
   */
  get<K extends keyof TData>(key: K): TData[K] | undefined;

  /**
   * Set a value in context using a type-safe ContextKey.
   *
   * @template T - Value type (inferred from key)
   * @param key - ContextKey to set
   * @param value - Value to store (must match key's type)
   *
   * @example
   * ```typescript
   * const USER_ID = new ContextKey<number>('userId');
   * ctx.set(USER_ID, 42);      // ✅ OK
   * ctx.set(USER_ID, 'wrong'); // ❌ Compile error
   * ```
   */
  set<T>(key: ContextKey<T>, value: T): void;

  /**
   * Set a value in context using a string key (legacy).
   *
   * @template K - Key type from TData
   * @param key - String key to set
   * @param value - Value to store
   */
  set<K extends keyof TData>(key: K, value: TData[K]): void;

  /**
   * Check if a key exists in context.
   *
   * @param key - ContextKey or string key to check
   * @returns True if the key exists
   */
  has(key: ContextKey<unknown> | string): boolean;

  /**
   * Delete a key from context.
   *
   * @param key - ContextKey or string key to delete
   * @returns True if the key existed and was deleted
   */
  delete(key: ContextKey<unknown> | string): boolean;

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Get all context data as a plain object.
   *
   * @returns Shallow copy of all context data
   *
   * @remarks
   * Useful for debugging, logging, or serialization.
   * Returns a copy - modifications won't affect the context.
   */
  getAll(): Readonly<Record<string, unknown>>;

  /**
   * Set multiple values at once.
   *
   * @param data - Object with key-value pairs to set
   *
   * @example
   * ```typescript
   * ctx.setAll({
   *   traceId: 'abc-123',
   *   userId: 'user-456',
   *   timestamp: Date.now(),
   * });
   * ```
   */
  setAll(data: Partial<TData>): void;

  // ============================================================================
  // Cancellation Support
  // ============================================================================

  /**
   * Check if this context has been cancelled.
   *
   * @returns True if cancelled
   *
   * @example
   * ```typescript
   * async function longTask(ctx: IContext) {
   *   for (let i = 0; i < 1000; i++) {
   *     if (ctx.isCancelled()) {
   *       throw new Error('Task cancelled');
   *     }
   *     await processItem(i);
   *   }
   * }
   * ```
   */
  isCancelled(): boolean;

  /**
   * Cancel this context and trigger all registered callbacks.
   *
   * @remarks
   * Cancellation is cooperative - long-running operations should
   * periodically check `isCancelled()` and stop if true.
   *
   * @example
   * ```typescript
   * // HTTP handler with client disconnect detection
   * res.on('close', () => {
   *   if (!res.writableEnded) {
   *     ctx.cancel();
   *   }
   * });
   * ```
   */
  cancel(): void;

  /**
   * Register a callback to be invoked when context is cancelled.
   *
   * @param callback - Function to call on cancellation
   * @returns Unsubscribe function to remove the callback
   *
   * @example
   * ```typescript
   * const unsubscribe = ctx.onCancel(() => {
   *   console.log('Cleaning up resources...');
   *   connection.close();
   * });
   *
   * // Later, if you want to remove the callback:
   * unsubscribe();
   * ```
   */
  onCancel(callback: CancelCallback): () => void;

  // ============================================================================
  // Context Cloning
  // ============================================================================

  /**
   * Create a shallow clone of this context with optional additional data.
   *
   * @param additionalData - Extra data to merge into the clone
   * @returns New context instance with cloned data
   *
   * @remarks
   * The clone is independent - changes to one don't affect the other.
   * Cancellation state is NOT copied (clone starts fresh).
   *
   * @example
   * ```typescript
   * const childCtx = ctx.clone({
   *   operationId: 'child-operation',
   * });
   * ```
   */
  clone(additionalData?: Partial<TData>): IContext<TData>;
}

/**
 * IContextProvider - Factory interface for creating context instances.
 *
 * @remarks
 * This interface is implemented by the Infrastructure layer to provide
 * context creation and lifecycle management.
 *
 * **Dependency Injection Pattern:**
 *
 * Applications should depend on IContextProvider rather than concrete
 * implementations like RequestContext.
 */
export interface IContextProvider<TData extends IStruktosContextData = IStruktosContextData> {
  /**
   * Create a new context scope and run a function within it.
   *
   * @template R - Return type of the callback
   * @param initialData - Initial context data
   * @param callback - Function to run within the context
   * @returns Result of the callback
   */
  run<R>(initialData: Partial<TData>, callback: () => R): R;

  /**
   * Get the current context, if any.
   *
   * @returns Current context or undefined if not in a context scope
   */
  current(): IContext<TData> | undefined;

  /**
   * Check if there's an active context.
   *
   * @returns True if a context is active
   */
  hasContext(): boolean;
}

/**
 * Dependency injection token for IContextProvider.
 */
export const CONTEXT_PROVIDER_TOKEN = Symbol('IContextProvider');

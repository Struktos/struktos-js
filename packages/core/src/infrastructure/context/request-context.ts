/**
 * @fileoverview RequestContext - AsyncLocalStorage-based Context Implementation
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module provides the concrete implementation of IContext using
 * Node.js AsyncLocalStorage. It enables automatic context propagation
 * across async boundaries without manual parameter passing.
 *
 * ## Key Features
 *
 * - **Zero-config propagation**: Context flows through Promise chains
 * - **Type-safe access**: Works with ContextKey<T> for compile-time safety
 * - **Cancellation support**: Cooperative cancellation with cleanup callbacks
 * - **High performance**: Optimized for minimal overhead
 *
 * ## Performance Considerations
 *
 * AsyncLocalStorage overhead is ~50-100 nanoseconds per `getStore()` call.
 * For hot paths, cache the context reference:
 *
 * ```typescript
 * // ✅ Good: Cache context for loop
 * const ctx = RequestContext.current();
 * for (const item of items) {
 *   processItem(item, ctx);
 * }
 *
 * // ❌ Avoid: Repeated getStore() calls
 * for (const item of items) {
 *   const ctx = RequestContext.current(); // Unnecessary overhead
 *   processItem(item, ctx);
 * }
 * ```
 *
 * @version 1.0.0
 */

import { AsyncLocalStorage } from 'async_hooks';

import {
  type IContext,
  type IContextProvider,
  type IStruktosContextData,
  type CancelCallback,
  type ContextKey,
} from '../../domain/context';

import {
  type IContextStore,
  createContextStore,
  cloneContextStore,
  storeToObject,
  resolveKeyId,
} from './context-store';

/**
 * Singleton AsyncLocalStorage instance.
 *
 * @remarks
 * This MUST be a singleton because:
 * 1. AsyncLocalStorage maintains a global registry of execution contexts
 * 2. Multiple instances would create separate, non-communicating registries
 * 3. Context wouldn't propagate across the separate registries
 *
 * @internal
 */
const contextStorage = new AsyncLocalStorage<IContextStore>();

/**
 * RequestContext - IContext implementation using AsyncLocalStorage.
 *
 * @template TData - Context data type, defaults to IStruktosContextData
 *
 * @remarks
 * **Usage Pattern: Static Factory + Instance Methods**
 *
 * ```typescript
 * // Create context scope (static factory)
 * RequestContext.run({ traceId: 'abc' }, async () => {
 *   // Get context instance
 *   const ctx = RequestContext.current();
 *
 *   // Use instance methods
 *   ctx?.set(USER_ID, 123);
 *   const userId = ctx?.get(USER_ID);
 * });
 * ```
 *
 * **Thread Safety (Async Safety):**
 *
 * Each async operation gets its own isolated context store.
 * Concurrent requests never interfere with each other.
 *
 * @example Basic HTTP middleware
 * ```typescript
 * app.use((req, res, next) => {
 *   RequestContext.run({
 *     traceId: req.headers['x-trace-id'] ?? generateId(),
 *     requestId: generateId(),
 *   }, () => next());
 * });
 *
 * app.get('/api/users', async (req, res) => {
 *   const ctx = RequestContext.current();
 *   console.log('Trace:', ctx?.get(TRACE_ID_KEY));
 *   // ... handle request
 * });
 * ```
 *
 * @example With cancellation
 * ```typescript
 * RequestContext.run({}, async () => {
 *   const ctx = RequestContext.current();
 *
 *   // Register cleanup
 *   ctx?.onCancel(() => {
 *     console.log('Cleaning up...');
 *   });
 *
 *   // Cancel on client disconnect
 *   res.on('close', () => ctx?.cancel());
 * });
 * ```
 */
export class RequestContext<
  TData extends IStruktosContextData = IStruktosContextData,
> implements IContext<TData> {
  /**
   * Reference to the underlying store.
   * @private
   */
  private readonly store: IContextStore;

  /**
   * Private constructor - use static factory methods.
   *
   * @param store - Context store to wrap
   * @private
   */
  private constructor(store: IContextStore) {
    this.store = store;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new context scope and run a function within it.
   *
   * @template TData - Context data type
   * @template R - Return type of the callback
   * @param initialData - Initial context data
   * @param callback - Function to run within the context
   * @returns Result of the callback
   *
   * @remarks
   * The context scope is active for the duration of the callback,
   * including all async operations spawned within it.
   *
   * @example
   * ```typescript
   * const result = await RequestContext.run(
   *   { traceId: 'abc-123' },
   *   async () => {
   *     const ctx = RequestContext.current();
   *     console.log(ctx?.get(TRACE_ID_KEY)); // 'abc-123'
   *     return await fetchData();
   *   }
   * );
   * ```
   */
  static run<TData extends IStruktosContextData = IStruktosContextData, R = unknown>(
    initialData: Partial<TData>,
    callback: () => R,
  ): R {
    const store = createContextStore(initialData as Record<string, unknown>);
    return contextStorage.run(store, callback);
  }

  /**
   * Run a function with an existing context.
   *
   * @template TData - Context data type
   * @template R - Return type
   * @param context - Existing RequestContext to use
   * @param callback - Function to run
   * @returns Result of the callback
   *
   * @remarks
   * Useful for restoring context in scenarios where automatic
   * propagation doesn't work (e.g., worker threads, external callbacks).
   */
  static runWithContext<TData extends IStruktosContextData = IStruktosContextData, R = unknown>(
    context: RequestContext<TData>,
    callback: () => R,
  ): R {
    return contextStorage.run(context.store, callback);
  }

  /**
   * Get the current context, if any.
   *
   * @template TData - Context data type
   * @returns RequestContext instance or undefined if not in a context scope
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * if (ctx) {
   *   const traceId = ctx.get(TRACE_ID_KEY);
   *   console.log('Request:', traceId);
   * } else {
   *   console.log('No context available');
   * }
   * ```
   */
  static current<TData extends IStruktosContextData = IStruktosContextData>():
    | RequestContext<TData>
    | undefined {
    const store = contextStorage.getStore();
    return store ? new RequestContext<TData>(store) : undefined;
  }

  /**
   * Get the current context or throw if not available.
   *
   * @template TData - Context data type
   * @returns RequestContext instance
   * @throws Error if no context is active
   *
   * @remarks
   * Use this when you're certain a context should exist.
   * Prefer `current()` for defensive coding.
   *
   * @example
   * ```typescript
   * // In middleware-protected handler
   * function handleRequest() {
   *   const ctx = RequestContext.require();
   *   // Safe to use - will throw if context missing
   *   return ctx.get(TRACE_ID_KEY);
   * }
   * ```
   */
  static require<
    TData extends IStruktosContextData = IStruktosContextData,
  >(): RequestContext<TData> {
    const ctx = RequestContext.current<TData>();
    if (!ctx) {
      throw new Error(
        'RequestContext.require() called outside of context scope. ' +
          'Ensure you are within RequestContext.run() or middleware has created a context.',
      );
    }
    return ctx;
  }

  /**
   * Check if there's an active context.
   *
   * @returns True if a context is active
   *
   * @remarks
   * More efficient than `current() !== undefined` because it
   * doesn't create a wrapper instance.
   */
  static hasContext(): boolean {
    return contextStorage.getStore() !== undefined;
  }

  /**
   * Get the raw AsyncLocalStorage instance.
   *
   * @returns The singleton AsyncLocalStorage instance
   *
   * @remarks
   * **Use with caution!** This exposes internals and should only
   * be used for advanced scenarios like:
   * - Manual context propagation to worker threads
   * - Integration with other ALS-based libraries
   * - Testing and debugging
   *
   * @internal
   */
  static get storage(): AsyncLocalStorage<IContextStore> {
    return contextStorage;
  }

  // ============================================================================
  // IContext Implementation - Get/Set Operations
  // ============================================================================

  /**
   * Get a value from context.
   *
   * Supports both ContextKey<T> and string keys.
   */
  get<T>(key: ContextKey<T>): T | undefined;
  get<K extends keyof TData>(key: K): TData[K] | undefined;
  get(key: ContextKey<unknown> | string): unknown {
    const keyId = resolveKeyId(key);
    const value = this.store.data.get(keyId);

    // If no value and key has defaultValue, return it
    if (value === undefined && typeof key === 'object' && 'defaultValue' in key) {
      return key.defaultValue;
    }

    return value;
  }

  /**
   * Set a value in context.
   *
   * Supports both ContextKey<T> and string keys.
   */
  set<T>(key: ContextKey<T>, value: T): void;
  set<K extends keyof TData>(key: K, value: TData[K]): void;
  set(key: ContextKey<unknown> | string, value: unknown): void {
    const keyId = resolveKeyId(key);
    this.store.data.set(keyId, value);
  }

  /**
   * Check if a key exists in context.
   */
  has(key: ContextKey<unknown> | string): boolean {
    const keyId = resolveKeyId(key);
    return this.store.data.has(keyId);
  }

  /**
   * Delete a key from context.
   */
  delete(key: ContextKey<unknown> | string): boolean {
    const keyId = resolveKeyId(key);
    return this.store.data.delete(keyId);
  }

  // ============================================================================
  // IContext Implementation - Bulk Operations
  // ============================================================================

  /**
   * Get all context data as a plain object.
   */
  getAll(): Readonly<Record<string, unknown>> {
    return Object.freeze(storeToObject(this.store));
  }

  /**
   * Set multiple values at once.
   */
  setAll(data: Partial<TData>): void {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        this.store.data.set(key, value);
      }
    }
  }

  // ============================================================================
  // IContext Implementation - Cancellation
  // ============================================================================

  /**
   * Check if this context has been cancelled.
   */
  isCancelled(): boolean {
    return this.store.cancelled;
  }

  /**
   * Cancel this context and invoke all registered callbacks.
   */
  cancel(): void {
    if (this.store.cancelled) {
      return; // Already cancelled
    }

    this.store.cancelled = true;

    // Invoke all callbacks
    for (const callback of this.store.cancelCallbacks) {
      try {
        const result = callback();
        // Handle async callbacks (fire and forget)
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Error in cancellation callback:', error);
          });
        }
      } catch (error) {
        console.error('Error in cancellation callback:', error);
      }
    }

    // Clear callbacks after invocation
    this.store.cancelCallbacks.clear();
  }

  /**
   * Register a callback to be invoked when context is cancelled.
   */
  onCancel(callback: CancelCallback): () => void {
    // If already cancelled, invoke immediately
    if (this.store.cancelled) {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Error in cancellation callback:', error);
          });
        }
      } catch (error) {
        console.error('Error in cancellation callback:', error);
      }
      return () => {}; // No-op unsubscribe
    }

    this.store.cancelCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.store.cancelCallbacks.delete(callback);
    };
  }

  // ============================================================================
  // IContext Implementation - Cloning
  // ============================================================================

  /**
   * Create a shallow clone with optional additional data.
   */
  clone(additionalData?: Partial<TData>): IContext<TData> {
    const clonedStore = cloneContextStore(this.store, additionalData as Record<string, unknown>);
    return new RequestContext<TData>(clonedStore);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the age of this context in milliseconds.
   */
  getAge(): number {
    return Date.now() - this.store.createdAt;
  }

  /**
   * Returns a string representation for debugging.
   */
  toString(): string {
    const keys = Array.from(this.store.data.keys());
    return `RequestContext(keys=${keys.length}, cancelled=${this.store.cancelled}, age=${this.getAge()}ms)`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current context, if any.
 *
 * @returns Current context or undefined
 *
 * @remarks
 * Convenience function that's shorter than `RequestContext.current()`.
 */
export function getCurrentContext<TData extends IStruktosContextData = IStruktosContextData>():
  | RequestContext<TData>
  | undefined {
  return RequestContext.current<TData>();
}

/**
 * Get the current context or throw if not available.
 *
 * @returns Current context
 * @throws Error if no context is active
 */
export function requireContext<
  TData extends IStruktosContextData = IStruktosContextData,
>(): RequestContext<TData> {
  return RequestContext.require<TData>();
}

// ============================================================================
// IContextProvider Implementation
// ============================================================================

/**
 * Default context provider implementation.
 *
 * @remarks
 * This can be registered with the DI container:
 *
 * ```typescript
 * container.register(CONTEXT_PROVIDER_TOKEN, {
 *   useValue: new RequestContextProvider(),
 * });
 * ```
 */
export class RequestContextProvider<
  TData extends IStruktosContextData = IStruktosContextData,
> implements IContextProvider<TData> {
  run<R>(initialData: Partial<TData>, callback: () => R): R {
    return RequestContext.run(initialData, callback);
  }

  current(): RequestContext<TData> | undefined {
    return RequestContext.current<TData>();
  }

  hasContext(): boolean {
    return RequestContext.hasContext();
  }
}

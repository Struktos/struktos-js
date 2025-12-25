/**
 * @fileoverview RequestContextProxy - Lazy Evaluation Context Proxy
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module provides a Proxy-based wrapper that defers AsyncLocalStorage
 * access until the moment a value is actually needed. This reduces overhead
 * in scenarios where context might not be accessed.
 *
 * ## Performance Optimization
 *
 * **The Problem:**
 *
 * Every `RequestContext.current()` call involves:
 * 1. AsyncLocalStorage.getStore() lookup (~50-100ns)
 * 2. Creating a new RequestContext wrapper instance
 *
 * In hot paths with many potential access points, this adds up.
 *
 * **The Solution: Lazy Proxy**
 *
 * ```typescript
 * // Eager (current approach)
 * const ctx = RequestContext.current(); // ALS lookup happens NOW
 * if (someCondition) {
 *   ctx?.get(KEY); // Might not even be reached
 * }
 *
 * // Lazy (proxy approach)
 * const ctx = RequestContextProxy.lazy(); // No ALS lookup yet
 * if (someCondition) {
 *   ctx.get(KEY); // ALS lookup happens NOW, only when needed
 * }
 * ```
 *
 * ## Use Cases
 *
 * 1. **Service constructors**: Create proxy, access context lazily
 * 2. **Middleware chains**: Pass proxy, access only if needed
 * 3. **Conditional logging**: Create proxy, log only on errors
 *
 * @version 1.0.0
 */

import {
  type IContext,
  type IStruktosContextData,
  type CancelCallback,
  type ContextKey,
} from '../../domain/context';

import { RequestContext } from './request-context';

/**
 * Configuration options for RequestContextProxy.
 */
export interface IContextProxyOptions<TData extends IStruktosContextData> {
  /**
   * Default values to return when context is not available.
   * These are merged with ContextKey defaults.
   */
  defaults?: Partial<TData>;

  /**
   * Whether to throw if context is not available.
   * Default: false (returns undefined/default values)
   */
  strict?: boolean;

  /**
   * Custom error message for strict mode.
   */
  strictMessage?: string;
}

/**
 * Internal state for the proxy.
 * @internal
 */
interface IProxyState<TData extends IStruktosContextData> {
  /** Cached context reference (populated on first access) */
  cachedContext: RequestContext<TData> | null | undefined;

  /** Whether we've attempted to resolve the context */
  resolved: boolean;

  /** Options passed to the proxy */
  options: IContextProxyOptions<TData>;
}

/**
 * RequestContextProxy - Lazy-loading context wrapper.
 *
 * @template TData - Context data type
 *
 * @remarks
 * **How It Works:**
 *
 * 1. `lazy()` creates a Proxy object immediately (no ALS access)
 * 2. When any method is called, the handler intercepts it
 * 3. First call resolves the actual context via ALS
 * 4. Subsequent calls use the cached context
 *
 * **Memory Efficiency:**
 *
 * The proxy caches the context reference, not the context itself.
 * This means:
 * - If context changes (shouldn't happen), you get stale data
 * - For normal use within a single request, this is safe
 *
 * **Thread Safety:**
 *
 * Each proxy instance caches the context at first access.
 * Different async operations get different proxy instances.
 *
 * @example Basic lazy access
 * ```typescript
 * // In a service constructor - no context yet
 * class UserService {
 *   private readonly ctx = RequestContextProxy.lazy();
 *
 *   async getUser(id: string): Promise<User> {
 *     // Context resolved HERE, only when method is called
 *     const traceId = this.ctx.get(TRACE_ID_KEY);
 *     console.log(`[${traceId}] Fetching user ${id}`);
 *     return this.repository.findById(id);
 *   }
 * }
 * ```
 *
 * @example With defaults
 * ```typescript
 * const ctx = RequestContextProxy.lazy({
 *   defaults: {
 *     traceId: 'unknown',
 *     userId: 'anonymous',
 *   },
 * });
 *
 * // If no context, returns 'unknown' instead of undefined
 * const traceId = ctx.get(TRACE_ID_KEY); // 'unknown'
 * ```
 *
 * @example Strict mode
 * ```typescript
 * const ctx = RequestContextProxy.lazy({
 *   strict: true,
 *   strictMessage: 'Context required for audit logging',
 * });
 *
 * // Throws if context is not available
 * ctx.get(TRACE_ID_KEY); // Error: Context required for audit logging
 * ```
 */
export class RequestContextProxy {
  /**
   * Create a lazy-loading context proxy.
   *
   * @template TData - Context data type
   * @param options - Proxy configuration
   * @returns IContext-compatible proxy object
   *
   * @example
   * ```typescript
   * const ctx = RequestContextProxy.lazy<MyContextData>();
   * // Later...
   * const value = ctx.get(MY_KEY);
   * ```
   */
  static lazy<TData extends IStruktosContextData = IStruktosContextData>(
    options: IContextProxyOptions<TData> = {},
  ): IContext<TData> {
    const state: IProxyState<TData> = {
      cachedContext: undefined, // undefined = not yet resolved
      resolved: false,
      options,
    };

    /**
     * Resolve the actual context (called on first access).
     */
    const resolveContext = (): RequestContext<TData> | null => {
      if (!state.resolved) {
        const current = RequestContext.current<TData>();
        state.cachedContext = current ?? null;
        state.resolved = true;
      }

      const context = state.cachedContext;

      if (context === null || context === undefined) {
        if (options.strict) {
          throw new Error(
            options.strictMessage ?? 'RequestContextProxy: Context not available in strict mode',
          );
        }
        return null;
      }

      return context;
    };

    /**
     * Get a value, falling back to defaults if no context.
     */
    const getValue = (key: ContextKey<unknown> | string): unknown => {
      const ctx = resolveContext();

      if (ctx) {
        return ctx.get(key as ContextKey<unknown>);
      }

      // No context - check defaults
      const keyId = typeof key === 'string' ? key : key.id;

      // Check options defaults
      if (options.defaults && keyId in options.defaults) {
        return (options.defaults as Record<string, unknown>)[keyId];
      }

      // Check ContextKey defaultValue
      if (typeof key === 'object' && 'defaultValue' in key) {
        return key.defaultValue;
      }

      return undefined;
    };

    /**
     * The proxy target object.
     * This is just a placeholder - all access goes through the handler.
     */
    const target: IContext<TData> = {
      get: () => undefined,
      set: () => {},
      has: () => false,
      delete: () => false,
      getAll: () => ({}),
      setAll: () => {},
      isCancelled: () => false,
      cancel: () => {},
      onCancel: () => () => {},
      clone: () => target,
    } as IContext<TData>;

    /**
     * Proxy handler that intercepts all method calls.
     */
    const handler: ProxyHandler<IContext<TData>> = {
      get(_, prop: string | symbol): unknown {
        // Handle special properties
        if (prop === Symbol.toStringTag) {
          return 'RequestContextProxy';
        }

        switch (prop) {
          case 'get':
            return (key: ContextKey<unknown> | string) => getValue(key);

          case 'set':
            return (key: ContextKey<unknown> | string, value: unknown) => {
              const ctx = resolveContext();
              if (ctx) {
                ctx.set(key as ContextKey<unknown>, value);
              }
              // Silent no-op if no context (could throw in strict mode)
            };

          case 'has':
            return (key: ContextKey<unknown> | string) => {
              const ctx = resolveContext();
              return ctx?.has(key) ?? false;
            };

          case 'delete':
            return (key: ContextKey<unknown> | string) => {
              const ctx = resolveContext();
              return ctx?.delete(key) ?? false;
            };

          case 'getAll':
            return () => {
              const ctx = resolveContext();
              if (ctx) {
                return ctx.getAll();
              }
              // Return defaults if available
              return options.defaults ? Object.freeze({ ...options.defaults }) : Object.freeze({});
            };

          case 'setAll':
            return (data: Partial<TData>) => {
              const ctx = resolveContext();
              ctx?.setAll(data);
            };

          case 'isCancelled':
            return () => {
              const ctx = resolveContext();
              return ctx?.isCancelled() ?? false;
            };

          case 'cancel':
            return () => {
              const ctx = resolveContext();
              ctx?.cancel();
            };

          case 'onCancel':
            return (callback: CancelCallback) => {
              const ctx = resolveContext();
              if (ctx) {
                return ctx.onCancel(callback);
              }
              // No context - return no-op unsubscribe
              return () => {};
            };

          case 'clone':
            return (additionalData?: Partial<TData>) => {
              const ctx = resolveContext();
              if (ctx) {
                return ctx.clone(additionalData);
              }
              // No context - return a new proxy with merged defaults
              return RequestContextProxy.lazy<TData>({
                ...options,
                defaults: {
                  ...options.defaults,
                  ...additionalData,
                } as Partial<TData>,
              });
            };

          // Internal methods for testing/debugging
          case '_isProxy':
            return true;

          case '_isResolved':
            return state.resolved;

          case '_hasContext':
            return () => {
              resolveContext();
              return state.cachedContext !== null;
            };

          default:
            return undefined;
        }
      },
    };

    return new Proxy(target, handler);
  }

  /**
   * Create a proxy with predefined defaults (no context resolution).
   *
   * @template TData - Context data type
   * @param defaults - Default values for all keys
   * @returns IContext-compatible object with default values
   *
   * @remarks
   * This creates a "fake" context that always returns defaults.
   * Useful for testing or when you know context won't be available.
   *
   * @example
   * ```typescript
   * // For testing
   * const mockCtx = RequestContextProxy.withDefaults({
   *   traceId: 'test-trace',
   *   userId: 'test-user',
   * });
   *
   * expect(mockCtx.get(TRACE_ID_KEY)).toBe('test-trace');
   * ```
   */
  static withDefaults<TData extends IStruktosContextData = IStruktosContextData>(
    defaults: Partial<TData>,
  ): IContext<TData> {
    const data = new Map<string, unknown>(Object.entries(defaults));

    return {
      get<T>(key: ContextKey<T> | string): T | undefined {
        const keyId = typeof key === 'string' ? key : key.id;
        const value = data.get(keyId);

        if (value !== undefined) {
          return value as T;
        }

        // Check ContextKey defaultValue
        if (typeof key === 'object' && 'defaultValue' in key) {
          return key.defaultValue as T;
        }

        return undefined;
      },

      set<T>(key: ContextKey<T> | string, value: T): void {
        const keyId = typeof key === 'string' ? key : key.id;
        data.set(keyId, value);
      },

      has(key: ContextKey<unknown> | string): boolean {
        const keyId = typeof key === 'string' ? key : key.id;
        return data.has(keyId);
      },

      delete(key: ContextKey<unknown> | string): boolean {
        const keyId = typeof key === 'string' ? key : key.id;
        return data.delete(keyId);
      },

      getAll(): Readonly<Record<string, unknown>> {
        return Object.freeze(Object.fromEntries(data));
      },

      setAll(newData: Partial<TData>): void {
        for (const [key, value] of Object.entries(newData)) {
          if (value !== undefined) {
            data.set(key, value);
          }
        }
      },

      isCancelled(): boolean {
        return false;
      },

      cancel(): void {
        // No-op for defaults-only context
      },

      onCancel(_callback: CancelCallback): () => void {
        return () => {}; // No-op
      },

      clone(additionalData?: Partial<TData>): IContext<TData> {
        return RequestContextProxy.withDefaults({
          ...defaults,
          ...additionalData,
        });
      },
    } as IContext<TData>;
  }

  /**
   * Check if an object is a RequestContextProxy.
   *
   * @param obj - Object to check
   * @returns True if obj is a proxy created by this class
   */
  static isProxy(obj: unknown): boolean {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      '_isProxy' in obj &&
      (obj as Record<string, unknown>)['_isProxy'] === true
    );
  }
}

/**
 * @fileoverview ContextKey<T> - Type-Safe Context Key
 *
 * @packageDocumentation
 * @module @struktos/core/domain/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN (Core)
 *
 * This module provides a type-safe mechanism for storing and retrieving
 * values from the context. Unlike string-based keys, ContextKey<T> ensures
 * compile-time type safety.
 *
 * ## The Problem with String Keys
 *
 * ```typescript
 * // ❌ BAD: String keys - no type safety
 * ctx.set('userId', 123);          // Number stored
 * const userId = ctx.get('userId'); // Type: unknown - requires casting!
 * const wrong = ctx.get('userID');  // Typo - silent failure!
 * ```
 *
 * ## The Solution: ContextKey<T>
 *
 * ```typescript
 * // ✅ GOOD: ContextKey<T> - compile-time safety
 * const USER_ID = new ContextKey<number>('userId');
 * ctx.set(USER_ID, 123);           // Type checked!
 * const userId = ctx.get(USER_ID); // Type: number | undefined
 * ctx.set(USER_ID, 'wrong');       // ❌ Compile error!
 * ```
 *
 * @version 1.0.0
 */

/**
 * Symbol used as internal brand for type discrimination.
 * @internal
 */
const CONTEXT_KEY_BRAND = Symbol('ContextKey');

/**
 * ContextKey<T> - A type-safe key for storing values in context.
 *
 * @template T - The type of value this key stores
 *
 * @remarks
 * **Design Philosophy:**
 *
 * ContextKey follows the "Newtype" pattern from functional programming.
 * It wraps a string identifier but carries type information at compile time.
 *
 * **Why Not Just Symbols?**
 *
 * Symbols provide uniqueness but not type safety:
 * ```typescript
 * const USER_ID = Symbol('userId');
 * ctx.set(USER_ID, 123);
 * ctx.set(USER_ID, 'string'); // No type error!
 * ```
 *
 * ContextKey provides both uniqueness AND type safety.
 *
 * **Thread Safety:**
 *
 * ContextKey instances are immutable and can be safely shared across
 * async boundaries. The key itself doesn't store values - it's just
 * an identifier with type information.
 *
 * @example Basic usage
 * ```typescript
 * // Define keys (typically as module-level constants)
 * export const TRACE_ID = new ContextKey<string>('traceId');
 * export const USER_ID = new ContextKey<number>('userId');
 * export const AUTH_TOKEN = new ContextKey<string>('authToken', { defaultValue: '' });
 *
 * // Use with context
 * ctx.set(TRACE_ID, 'abc-123');
 * const traceId = ctx.get(TRACE_ID); // Type: string | undefined
 * ```
 *
 * @example With default value
 * ```typescript
 * const TIMEOUT = new ContextKey<number>('timeout', { defaultValue: 30000 });
 *
 * // If not set, returns defaultValue
 * const timeout = ctx.get(TIMEOUT); // 30000 (default)
 *
 * ctx.set(TIMEOUT, 60000);
 * const timeout2 = ctx.get(TIMEOUT); // 60000 (explicitly set)
 * ```
 *
 * @example Type-safe enforcement
 * ```typescript
 * const COUNT = new ContextKey<number>('count');
 *
 * ctx.set(COUNT, 42);       // ✅ OK
 * ctx.set(COUNT, 'forty');  // ❌ Compile error: string not assignable to number
 *
 * const value: number | undefined = ctx.get(COUNT); // ✅ Correctly typed
 * ```
 */
export class ContextKey<T> {
  /**
   * Internal brand for type discrimination.
   * This ensures ContextKey instances are properly identified.
   * @internal
   */
  readonly [CONTEXT_KEY_BRAND]: true = true;

  /**
   * Unique identifier for this key.
   * Used as the actual key in the underlying Map storage.
   */
  readonly id: string;

  /**
   * Human-readable description of what this key stores.
   * Useful for debugging and error messages.
   */
  readonly description?: string;

  /**
   * Default value to return when the key is not set in context.
   * If undefined, get() returns undefined when key is not found.
   */
  readonly defaultValue?: T;

  /**
   * Phantom type field to carry type information.
   * This is never actually used at runtime - it's purely for TypeScript.
   * @internal
   */
  declare readonly _type: T;

  /**
   * Create a new ContextKey.
   *
   * @param id - Unique identifier for this key
   * @param options - Optional configuration
   * @param options.description - Human-readable description
   * @param options.defaultValue - Default value when key is not set
   *
   * @example
   * ```typescript
   * // Simple key
   * const USER_ID = new ContextKey<string>('userId');
   *
   * // With description
   * const TRACE_ID = new ContextKey<string>('traceId', {
   *   description: 'Distributed tracing correlation ID',
   * });
   *
   * // With default value
   * const TIMEOUT = new ContextKey<number>('timeout', {
   *   description: 'Request timeout in milliseconds',
   *   defaultValue: 30000,
   * });
   * ```
   */
  constructor(
    id: string,
    options?: {
      description?: string;
      defaultValue?: T;
    },
  ) {
    this.id = id;
    if (options?.description !== undefined) this.description = options.description;
    if (options?.defaultValue !== undefined) this.defaultValue = options.defaultValue;
    Object.freeze(this);
  }

  /**
   * Returns the string representation of this key.
   * @returns The key's id
   */
  toString(): string {
    return `ContextKey(${this.id})`;
  }

  /**
   * Check if a value is a ContextKey instance.
   *
   * @param value - Value to check
   * @returns True if value is a ContextKey
   *
   * @example
   * ```typescript
   * const key = new ContextKey<string>('test');
   * ContextKey.isContextKey(key); // true
   * ContextKey.isContextKey('string'); // false
   * ```
   */
  static isContextKey(value: unknown): value is ContextKey<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      CONTEXT_KEY_BRAND in value &&
      (value as Record<symbol, unknown>)[CONTEXT_KEY_BRAND] === true
    );
  }
}

/**
 * Type helper to extract the value type from a ContextKey.
 *
 * @template K - The ContextKey type
 *
 * @example
 * ```typescript
 * const USER_ID = new ContextKey<number>('userId');
 * type UserId = ContextKeyValue<typeof USER_ID>; // number
 * ```
 */
export type ContextKeyValue<K> = K extends ContextKey<infer V> ? V : never;

/**
 * Type helper to ensure a value matches the expected type for a key.
 *
 * @template K - The ContextKey type
 *
 * @example
 * ```typescript
 * function setValue<K extends ContextKey<unknown>>(
 *   key: K,
 *   value: ContextKeyType<K>
 * ): void {
 *   // value is correctly typed based on key
 * }
 * ```
 */
export type ContextKeyType<K extends ContextKey<unknown>> =
  K extends ContextKey<infer V> ? V : never;

// ============================================================================
// Pre-defined Context Keys (Common across Struktos.js)
// ============================================================================

/**
 * Standard context key for distributed tracing correlation ID.
 *
 * @remarks
 * This key is used by Struktos.js middleware and adapters to propagate
 * trace IDs across service boundaries.
 *
 * @example
 * ```typescript
 * import { TRACE_ID_KEY } from '@struktos/core';
 *
 * ctx.set(TRACE_ID_KEY, 'abc-123-def-456');
 * const traceId = ctx.get(TRACE_ID_KEY);
 * ```
 */
export const TRACE_ID_KEY = new ContextKey<string>('struktos:traceId', {
  description: 'Distributed tracing correlation ID',
});

/**
 * Standard context key for request ID (unique per request).
 */
export const REQUEST_ID_KEY = new ContextKey<string>('struktos:requestId', {
  description: 'Unique identifier for this request',
});

/**
 * Standard context key for authenticated user ID.
 */
export const USER_ID_KEY = new ContextKey<string>('struktos:userId', {
  description: 'Authenticated user identifier',
});

/**
 * Standard context key for request start timestamp.
 */
export const TIMESTAMP_KEY = new ContextKey<number>('struktos:timestamp', {
  description: 'Request start timestamp (epoch ms)',
});

/**
 * Standard context key for cancellation signal.
 */
export const CANCELLED_KEY = new ContextKey<boolean>('struktos:cancelled', {
  description: 'Whether the request has been cancelled',
  defaultValue: false,
});

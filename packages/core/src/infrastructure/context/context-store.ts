/**
 * @fileoverview Context Store - Internal Storage Structure
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module defines the internal storage structure used by RequestContext.
 * It's an implementation detail and should not be exposed to consumers.
 *
 * @internal
 */

import { type CancelCallback } from '../../domain/context';

/**
 * Internal store structure for context data.
 *
 * @remarks
 * **Why a Separate Store Structure?**
 *
 * We use a dedicated store structure rather than storing data directly because:
 *
 * 1. **Separation of Concerns**: Data vs. metadata (callbacks, cancelled flag)
 * 2. **Performance**: Map is faster for frequent get/set operations
 * 3. **Extensibility**: Easy to add new metadata fields
 *
 * **Why Map Instead of Object?**
 *
 * - ✅ O(1) average case for get/set/delete
 * - ✅ Preserves insertion order (useful for debugging)
 * - ✅ Built-in `has()` method
 * - ✅ Can use any value as key (future-proofing)
 * - ✅ No prototype pollution concerns
 *
 * **Why Set for Callbacks?**
 *
 * - ✅ Automatic deduplication
 * - ✅ Efficient iteration
 * - ✅ O(1) add/delete
 *
 * @internal
 */
export interface IContextStore {
  /**
   * Key-value store for context data.
   * Keys are string IDs from ContextKey or raw strings.
   */
  readonly data: Map<string, unknown>;

  /**
   * Set of callbacks to invoke on cancellation.
   * Callbacks are invoked in registration order.
   */
  readonly cancelCallbacks: Set<CancelCallback>;

  /**
   * Whether this context has been cancelled.
   * Once true, remains true (cancellation is irreversible).
   */
  cancelled: boolean;

  /**
   * Timestamp when the context was created.
   * Used for debugging and performance tracking.
   */
  readonly createdAt: number;
}

/**
 * Create a new context store with optional initial data.
 *
 * @param initialData - Optional initial key-value pairs
 * @returns New context store instance
 *
 * @internal
 */
export function createContextStore(initialData?: Record<string, unknown>): IContextStore {
  const data = new Map<string, unknown>();

  // Populate initial data if provided
  if (initialData) {
    for (const [key, value] of Object.entries(initialData)) {
      if (value !== undefined) {
        data.set(key, value);
      }
    }
  }

  return {
    data,
    cancelCallbacks: new Set(),
    cancelled: false,
    createdAt: Date.now(),
  };
}

/**
 * Clone a context store with optional additional data.
 *
 * @param source - Source store to clone
 * @param additionalData - Extra data to merge
 * @returns New context store with cloned data
 *
 * @remarks
 * - Data is shallow-cloned (Map entries are copied, not deep-cloned)
 * - Cancellation callbacks are NOT copied (clone starts fresh)
 * - Cancelled state is NOT copied (clone starts as not cancelled)
 *
 * @internal
 */
export function cloneContextStore(
  source: IContextStore,
  additionalData?: Record<string, unknown>,
): IContextStore {
  const data = new Map(source.data);

  // Merge additional data
  if (additionalData) {
    for (const [key, value] of Object.entries(additionalData)) {
      if (value !== undefined) {
        data.set(key, value);
      }
    }
  }

  return {
    data,
    cancelCallbacks: new Set(), // Fresh callbacks
    cancelled: false, // Reset cancelled state
    createdAt: Date.now(),
  };
}

/**
 * Convert store data to a plain object.
 *
 * @param store - Context store to convert
 * @returns Plain object with all key-value pairs
 *
 * @internal
 */
export function storeToObject(store: IContextStore): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of store.data) {
    result[key] = value;
  }
  return result;
}

/**
 * Extract the key ID from a ContextKey or string.
 *
 * @param key - ContextKey instance or string key
 * @returns String key ID
 *
 * @internal
 */
export function resolveKeyId(key: { id?: string } | string): string {
  if (typeof key === 'string') {
    return key;
  }
  if (typeof key === 'object' && key !== null && 'id' in key) {
    return key.id as string;
  }
  throw new TypeError(`Invalid context key: ${String(key)}`);
}

/**
 * @fileoverview RequestContext Unit Tests
 *
 * Tests for the AsyncLocalStorage-based context implementation.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';

import { ContextKey } from '../../../src/domain/context/index.js';
import {
  RequestContext,
  RequestContextProvider,
  getCurrentContext,
  requireContext,
} from '../../../src/infrastructure/context/index.js';

// Custom keys for testing
const TEST_KEY = new ContextKey<string>('testKey');
const NUMBER_KEY = new ContextKey<number>('numberKey');
const DEFAULT_KEY = new ContextKey<string>('defaultKey', { defaultValue: 'default-value' });

describe('RequestContext', () => {
  // ============================================================================
  // Static Method Tests
  // ============================================================================

  describe('static run()', () => {
    it('should create context scope with initial data', () => {
      RequestContext.run({ traceId: 'test-trace' }, () => {
        const ctx = RequestContext.current();

        expect(ctx).toBeDefined();
        expect(ctx?.get('traceId')).toBe('test-trace');
      });
    });

    it('should return callback result', () => {
      const result = RequestContext.run({}, () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should support async callbacks', async () => {
      const result = await RequestContext.run({ traceId: 'async-trace' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const ctx = RequestContext.current();
        return ctx?.get('traceId');
      });

      expect(result).toBe('async-trace');
    });

    it('should isolate context between runs', () => {
      let capturedInRun1: string | undefined;
      let capturedInRun2: string | undefined;

      RequestContext.run({ traceId: 'run1' }, () => {
        capturedInRun1 = RequestContext.current()?.get('traceId');
      });

      RequestContext.run({ traceId: 'run2' }, () => {
        capturedInRun2 = RequestContext.current()?.get('traceId');
      });

      expect(capturedInRun1).toBe('run1');
      expect(capturedInRun2).toBe('run2');
    });

    it('should handle nested runs with fresh context', () => {
      RequestContext.run({ traceId: 'outer' }, () => {
        const outerCtx = RequestContext.current();
        expect(outerCtx?.get('traceId')).toBe('outer');

        // Inner run creates new context (not child context)
        RequestContext.run({ traceId: 'inner' }, () => {
          const innerCtx = RequestContext.current();
          expect(innerCtx?.get('traceId')).toBe('inner');
        });

        // Back to outer
        expect(outerCtx?.get('traceId')).toBe('outer');
      });
    });
  });

  describe('static current()', () => {
    it('should return undefined outside of context scope', () => {
      const ctx = RequestContext.current();
      expect(ctx).toBeUndefined();
    });

    it('should return context inside scope', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current();
        expect(ctx).toBeDefined();
      });
    });

    it('should return different wrapper instances for same store', () => {
      RequestContext.run({}, () => {
        const ctx1 = RequestContext.current();
        const ctx2 = RequestContext.current();

        // Different instances
        expect(ctx1).not.toBe(ctx2);

        // But same underlying data
        ctx1?.set(TEST_KEY, 'value');
        expect(ctx2?.get(TEST_KEY)).toBe('value');
      });
    });
  });

  describe('static require()', () => {
    it('should return context when available', () => {
      RequestContext.run({ traceId: 'test' }, () => {
        const ctx = RequestContext.require();
        expect(ctx).toBeDefined();
        expect(ctx.get('traceId')).toBe('test');
      });
    });

    it('should throw when context not available', () => {
      expect(() => RequestContext.require()).toThrow(
        /RequestContext.require\(\) called outside of context scope/,
      );
    });
  });

  describe('static hasContext()', () => {
    it('should return false outside scope', () => {
      expect(RequestContext.hasContext()).toBe(false);
    });

    it('should return true inside scope', () => {
      RequestContext.run({}, () => {
        expect(RequestContext.hasContext()).toBe(true);
      });
    });
  });

  describe('static runWithContext()', () => {
    it('should restore context from existing instance', () => {
      let capturedCtx: RequestContext | undefined;

      // First, create a context and capture it
      RequestContext.run({ traceId: 'original' }, () => {
        capturedCtx = RequestContext.current();
      });

      // Outside original scope, no context
      expect(RequestContext.hasContext()).toBe(false);

      // Restore the captured context
      if (capturedCtx) {
        RequestContext.runWithContext(capturedCtx, () => {
          const ctx = RequestContext.current();
          expect(ctx?.get('traceId')).toBe('original');
        });
      }
    });
  });

  // ============================================================================
  // Instance Method Tests - Get/Set
  // ============================================================================

  describe('get() and set()', () => {
    it('should get and set values with ContextKey', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set(TEST_KEY, 'hello');
        expect(ctx.get(TEST_KEY)).toBe('hello');
      });
    });

    it('should get and set values with string key', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set('customKey', 'world');
        expect(ctx.get('customKey')).toBe('world');
      });
    });

    it('should return undefined for non-existent key', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        expect(ctx.get(TEST_KEY)).toBeUndefined();
      });
    });

    it('should return defaultValue for key with default', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        // Key not set, should return defaultValue
        expect(ctx.get(DEFAULT_KEY)).toBe('default-value');

        // After setting, should return set value
        ctx.set(DEFAULT_KEY, 'custom');
        expect(ctx.get(DEFAULT_KEY)).toBe('custom');
      });
    });

    it('should handle null values', () => {
      const NULLABLE_KEY = new ContextKey<string | null>('nullable');

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set(NULLABLE_KEY, null);
        expect(ctx.get(NULLABLE_KEY)).toBeNull();
      });
    });

    it('should handle different types', () => {
      const STRING_KEY = new ContextKey<string>('string');
      const NUMBER_KEY = new ContextKey<number>('number');
      const BOOL_KEY = new ContextKey<boolean>('bool');
      const ARRAY_KEY = new ContextKey<number[]>('array');
      const OBJ_KEY = new ContextKey<{ a: number }>('obj');

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set(STRING_KEY, 'hello');
        ctx.set(NUMBER_KEY, 42);
        ctx.set(BOOL_KEY, true);
        ctx.set(ARRAY_KEY, [1, 2, 3]);
        ctx.set(OBJ_KEY, { a: 1 });

        expect(ctx.get(STRING_KEY)).toBe('hello');
        expect(ctx.get(NUMBER_KEY)).toBe(42);
        expect(ctx.get(BOOL_KEY)).toBe(true);
        expect(ctx.get(ARRAY_KEY)).toEqual([1, 2, 3]);
        expect(ctx.get(OBJ_KEY)).toEqual({ a: 1 });
      });
    });
  });

  describe('has()', () => {
    it('should return true for existing key', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set(TEST_KEY, 'value');
        expect(ctx.has(TEST_KEY)).toBe(true);
      });
    });

    it('should return false for non-existent key', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        expect(ctx.has(TEST_KEY)).toBe(false);
      });
    });

    it('should work with string keys', () => {
      RequestContext.run({ existingKey: 'value' }, () => {
        const ctx = RequestContext.current()!;

        expect(ctx.has('existingKey')).toBe(true);
        expect(ctx.has('nonExistent')).toBe(false);
      });
    });
  });

  describe('delete()', () => {
    it('should delete existing key and return true', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.set(TEST_KEY, 'value');
        expect(ctx.has(TEST_KEY)).toBe(true);

        const result = ctx.delete(TEST_KEY);
        expect(result).toBe(true);
        expect(ctx.has(TEST_KEY)).toBe(false);
      });
    });

    it('should return false for non-existent key', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        const result = ctx.delete(TEST_KEY);
        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Bulk Operations Tests
  // ============================================================================

  describe('getAll()', () => {
    it('should return all context data', () => {
      RequestContext.run({ traceId: 'trace', userId: 'user' }, () => {
        const ctx = RequestContext.current()!;
        ctx.set(NUMBER_KEY, 123);

        const all = ctx.getAll();

        expect(all['traceId']).toBe('trace');
        expect(all['userId']).toBe('user');
        expect(all['numberKey']).toBe(123);
      });
    });

    it('should return frozen object', () => {
      RequestContext.run({ traceId: 'trace' }, () => {
        const ctx = RequestContext.current()!;
        const all = ctx.getAll();

        expect(Object.isFrozen(all)).toBe(true);
      });
    });

    it('should return copy, not reference', () => {
      RequestContext.run({ traceId: 'trace' }, () => {
        const ctx = RequestContext.current()!;
        const all1 = ctx.getAll();

        ctx.set(TEST_KEY, 'new');

        const all2 = ctx.getAll();
        expect(all1).not.toBe(all2);
        expect(all1['testKey']).toBeUndefined();
        expect(all2['testKey']).toBe('new');
      });
    });
  });

  describe('setAll()', () => {
    it('should set multiple values at once', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.setAll({
          traceId: 'trace',
          userId: 'user',
          timestamp: 12345,
        });

        expect(ctx.get('traceId')).toBe('trace');
        expect(ctx.get('userId')).toBe('user');
        expect(ctx.get('timestamp')).toBe(12345);
      });
    });

    it('should skip undefined values', () => {
      RequestContext.run({ traceId: 'original' }, () => {
        const ctx = RequestContext.current()!;

        ctx.setAll({
          traceId: undefined,
          userId: 'user',
        } as any);

        expect(ctx.get('traceId')).toBe('original');
        expect(ctx.get('userId')).toBe('user');
      });
    });
  });

  // ============================================================================
  // Cancellation Tests
  // ============================================================================

  describe('isCancelled()', () => {
    it('should return false by default', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;
        expect(ctx.isCancelled()).toBe(false);
      });
    });

    it('should return true after cancel()', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;
        ctx.cancel();
        expect(ctx.isCancelled()).toBe(true);
      });
    });
  });

  describe('cancel()', () => {
    it('should invoke all registered callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.onCancel(callback1);
        ctx.onCancel(callback2);
        ctx.cancel();

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
      });
    });

    it('should only invoke callbacks once', () => {
      const callback = vi.fn();

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.onCancel(callback);
        ctx.cancel();
        ctx.cancel(); // Second cancel

        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle async callbacks', async () => {
      const asyncCallback = vi.fn().mockResolvedValue(undefined);

      await RequestContext.run({}, async () => {
        const ctx = RequestContext.current()!;

        ctx.onCancel(asyncCallback);
        ctx.cancel();

        // Wait for async callbacks
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(asyncCallback).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.onCancel(errorCallback);
        ctx.onCancel(successCallback);

        // Should not throw
        expect(() => ctx.cancel()).not.toThrow();

        // Both callbacks called
        expect(errorCallback).toHaveBeenCalled();
        expect(successCallback).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('onCancel()', () => {
    it('should return unsubscribe function', () => {
      const callback = vi.fn();

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        const unsubscribe = ctx.onCancel(callback);
        unsubscribe();
        ctx.cancel();

        expect(callback).not.toHaveBeenCalled();
      });
    });

    it('should invoke immediately if already cancelled', () => {
      const callback = vi.fn();

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;

        ctx.cancel();
        ctx.onCancel(callback); // Registered after cancel

        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================================
  // Clone Tests
  // ============================================================================

  describe('clone()', () => {
    it('should create independent copy', () => {
      RequestContext.run({ traceId: 'original' }, () => {
        const ctx = RequestContext.current()!;
        const cloned = ctx.clone();

        // Initial values copied
        expect(cloned.get('traceId')).toBe('original');

        // Changes don't affect original
        cloned.set(TEST_KEY, 'cloned-value');
        expect(ctx.get(TEST_KEY)).toBeUndefined();
      });
    });

    it('should merge additional data', () => {
      RequestContext.run({ traceId: 'original' }, () => {
        const ctx = RequestContext.current()!;
        const cloned = ctx.clone({ userId: 'new-user' });

        expect(cloned.get('traceId')).toBe('original');
        expect(cloned.get('userId')).toBe('new-user');
      });
    });

    it('should not copy cancellation state', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;
        ctx.cancel();

        const cloned = ctx.clone();

        expect(ctx.isCancelled()).toBe(true);
        expect(cloned.isCancelled()).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility Method Tests
  // ============================================================================

  describe('getAge()', () => {
    it('should return positive number', () => {
      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;
        const age = ctx.getAge();

        expect(age).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('toString()', () => {
    it('should return formatted string', () => {
      RequestContext.run({ a: 1, b: 2 }, () => {
        const ctx = RequestContext.current()!;
        const str = ctx.toString();

        expect(str).toMatch(/RequestContext\(keys=\d+, cancelled=false, age=\d+ms\)/);
      });
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('getCurrentContext()', () => {
    it('should return context inside scope', () => {
      RequestContext.run({}, () => {
        const ctx = getCurrentContext();
        expect(ctx).toBeDefined();
      });
    });

    it('should return undefined outside scope', () => {
      const ctx = getCurrentContext();
      expect(ctx).toBeUndefined();
    });
  });

  describe('requireContext()', () => {
    it('should return context inside scope', () => {
      RequestContext.run({}, () => {
        const ctx = requireContext();
        expect(ctx).toBeDefined();
      });
    });

    it('should throw outside scope', () => {
      expect(() => requireContext()).toThrow();
    });
  });

  // ============================================================================
  // RequestContextProvider Tests
  // ============================================================================

  describe('RequestContextProvider', () => {
    it('should implement IContextProvider', () => {
      const provider = new RequestContextProvider();

      expect(provider.run).toBeDefined();
      expect(provider.current).toBeDefined();
      expect(provider.hasContext).toBeDefined();
    });

    it('should work same as static methods', () => {
      const provider = new RequestContextProvider();

      const result = provider.run({ traceId: 'test' }, () => {
        const ctx = provider.current();
        return ctx?.get('traceId');
      });

      expect(result).toBe('test');
    });
  });
});

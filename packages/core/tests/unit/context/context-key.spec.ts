/**
 * @fileoverview ContextKey Unit Tests
 *
 * Tests for the type-safe context key implementation.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import {
  ContextKey,
  TRACE_ID_KEY,
  REQUEST_ID_KEY,
  USER_ID_KEY,
  TIMESTAMP_KEY,
  CANCELLED_KEY,
} from '../../../src/domain/context/index.js';

describe('ContextKey', () => {
  // ============================================================================
  // Construction Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create a key with only id', () => {
      const key = new ContextKey<string>('testKey');

      expect(key.id).toBe('testKey');
      expect(key.description).toBeUndefined();
      expect(key.defaultValue).toBeUndefined();
    });

    it('should create a key with description', () => {
      const key = new ContextKey<number>('count', {
        description: 'Request count',
      });

      expect(key.id).toBe('count');
      expect(key.description).toBe('Request count');
      expect(key.defaultValue).toBeUndefined();
    });

    it('should create a key with defaultValue', () => {
      const key = new ContextKey<number>('timeout', {
        defaultValue: 30000,
      });

      expect(key.id).toBe('timeout');
      expect(key.defaultValue).toBe(30000);
    });

    it('should create a key with all options', () => {
      const key = new ContextKey<boolean>('enabled', {
        description: 'Feature flag',
        defaultValue: false,
      });

      expect(key.id).toBe('enabled');
      expect(key.description).toBe('Feature flag');
      expect(key.defaultValue).toBe(false);
    });

    it('should support complex types', () => {
      interface IUserData {
        id: number;
        name: string;
        roles: string[];
      }

      const key = new ContextKey<IUserData>('user', {
        defaultValue: { id: 0, name: 'anonymous', roles: [] },
      });

      expect(key.id).toBe('user');
      expect(key.defaultValue).toEqual({ id: 0, name: 'anonymous', roles: [] });
    });

    it('should support null as defaultValue', () => {
      const key = new ContextKey<string | null>('nullable', {
        defaultValue: null,
      });

      expect(key.defaultValue).toBeNull();
    });

    it('should support undefined as explicit value', () => {
      const key = new ContextKey<string | undefined>('optional', {
        defaultValue: undefined,
      });

      expect(key.defaultValue).toBeUndefined();
    });
  });

  // ============================================================================
  // toString Tests
  // ============================================================================

  describe('toString', () => {
    it('should return formatted string representation', () => {
      const key = new ContextKey<string>('myKey');

      expect(key.toString()).toBe('ContextKey(myKey)');
    });

    it('should work with string interpolation', () => {
      const key = new ContextKey<string>('test');

      expect(`Key: ${key}`).toBe('Key: ContextKey(test)');
    });
  });

  // ============================================================================
  // isContextKey Tests
  // ============================================================================

  describe('isContextKey', () => {
    it('should return true for ContextKey instances', () => {
      const key = new ContextKey<string>('test');

      expect(ContextKey.isContextKey(key)).toBe(true);
    });

    it('should return false for strings', () => {
      expect(ContextKey.isContextKey('test')).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(ContextKey.isContextKey(123)).toBe(false);
    });

    it('should return false for null', () => {
      expect(ContextKey.isContextKey(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(ContextKey.isContextKey(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const obj = { id: 'test', description: 'fake' };

      expect(ContextKey.isContextKey(obj)).toBe(false);
    });

    it('should return false for objects with matching shape but no brand', () => {
      const fake = {
        id: 'test',
        description: 'fake key',
        defaultValue: 'default',
      };

      expect(ContextKey.isContextKey(fake)).toBe(false);
    });
  });

  // ============================================================================
  // Pre-defined Keys Tests
  // ============================================================================

  describe('pre-defined keys', () => {
    it('should have TRACE_ID_KEY defined', () => {
      expect(TRACE_ID_KEY).toBeDefined();
      expect(TRACE_ID_KEY.id).toBe('struktos:traceId');
      expect(TRACE_ID_KEY.description).toBe('Distributed tracing correlation ID');
    });

    it('should have REQUEST_ID_KEY defined', () => {
      expect(REQUEST_ID_KEY).toBeDefined();
      expect(REQUEST_ID_KEY.id).toBe('struktos:requestId');
    });

    it('should have USER_ID_KEY defined', () => {
      expect(USER_ID_KEY).toBeDefined();
      expect(USER_ID_KEY.id).toBe('struktos:userId');
    });

    it('should have TIMESTAMP_KEY defined', () => {
      expect(TIMESTAMP_KEY).toBeDefined();
      expect(TIMESTAMP_KEY.id).toBe('struktos:timestamp');
    });

    it('should have CANCELLED_KEY with defaultValue false', () => {
      expect(CANCELLED_KEY).toBeDefined();
      expect(CANCELLED_KEY.id).toBe('struktos:cancelled');
      expect(CANCELLED_KEY.defaultValue).toBe(false);
    });

    it('should all be ContextKey instances', () => {
      expect(ContextKey.isContextKey(TRACE_ID_KEY)).toBe(true);
      expect(ContextKey.isContextKey(REQUEST_ID_KEY)).toBe(true);
      expect(ContextKey.isContextKey(USER_ID_KEY)).toBe(true);
      expect(ContextKey.isContextKey(TIMESTAMP_KEY)).toBe(true);
      expect(ContextKey.isContextKey(CANCELLED_KEY)).toBe(true);
    });
  });

  // ============================================================================
  // Immutability Tests
  // ============================================================================

  describe('immutability', () => {
    it('should have readonly id', () => {
      const key = new ContextKey<string>('test');

      expect(() => {
        (key as any).id = 'changed';
      }).toThrow();
    });

    it('should have readonly description', () => {
      const key = new ContextKey<string>('test', { description: 'original' });

      expect(() => {
        (key as any).description = 'changed';
      }).toThrow();
    });

    it('should have readonly defaultValue', () => {
      const key = new ContextKey<number>('test', { defaultValue: 100 });

      expect(() => {
        (key as any).defaultValue = 200;
      }).toThrow();
    });
  });

  // ============================================================================
  // Type Safety Tests (Compile-time, documented here)
  // ============================================================================

  describe('type safety', () => {
    it('should enforce type on defaultValue', () => {
      // This compiles and works
      const numKey = new ContextKey<number>('num', { defaultValue: 42 });
      expect(numKey.defaultValue).toBe(42);

      // This would NOT compile:
      // const badKey = new ContextKey<number>('bad', { defaultValue: 'string' });
    });

    it('should allow union types', () => {
      const key = new ContextKey<string | number>('union', {
        defaultValue: 'initial',
      });

      expect(key.defaultValue).toBe('initial');

      // Both string and number would be valid for this key
    });

    it('should allow array types', () => {
      const key = new ContextKey<string[]>('tags', {
        defaultValue: ['default'],
      });

      expect(key.defaultValue).toEqual(['default']);
    });
  });
});

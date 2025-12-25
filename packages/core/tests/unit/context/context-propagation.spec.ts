/**
 * @fileoverview Context Propagation Integration Tests
 *
 * Validates that AsyncLocalStorage correctly propagates context across
 * various async boundaries. This is critical for Hexagonal Architecture
 * as context (traceId, userId) must flow through all layers.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import { AutoContextBehavior } from '../../../src/application/context/index.js';
import {
  ContextKey,
  type IContext,
  type IStruktosContextData,
  TRACE_ID_KEY,
} from '../../../src/domain/context/index.js';
import { RequestContext, RequestContextProxy } from '../../../src/infrastructure/context/index.js';

// Test utilities
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Custom keys for testing
const OPERATION_KEY = new ContextKey<string>('operation');
const DEPTH_KEY = new ContextKey<number>('depth', { defaultValue: 0 });

describe('Context Propagation - AsyncLocalStorage', () => {
  // ============================================================================
  // Promise Chain Propagation
  // ============================================================================

  describe('Promise Chain Propagation', () => {
    it('should propagate through Promise.then() chain', async () => {
      let capturedTraceId: string | undefined;

      await RequestContext.run({ traceId: 'trace-abc-123' }, async () => {
        await Promise.resolve()
          .then(() => {
            const ctx = RequestContext.current();
            capturedTraceId = ctx?.get('traceId');
          })
          .then(() => {
            const ctx = RequestContext.current();
            expect(ctx?.get('traceId')).toBe('trace-abc-123');
          });
      });

      expect(capturedTraceId).toBe('trace-abc-123');
    });

    it('should propagate through async/await chain', async () => {
      await RequestContext.run({ traceId: 'async-trace' }, async () => {
        const step1 = await (async () => {
          return RequestContext.current()?.get('traceId');
        })();

        const step2 = await (async () => {
          await delay(10);
          return RequestContext.current()?.get('traceId');
        })();

        expect(step1).toBe('async-trace');
        expect(step2).toBe('async-trace');
      });
    });

    it('should propagate through Promise.all()', async () => {
      await RequestContext.run({ traceId: 'parallel-trace' }, async () => {
        const results = await Promise.all([
          (async () => {
            await delay(5);
            return RequestContext.current()?.get('traceId');
          })(),
          (async () => {
            await delay(10);
            return RequestContext.current()?.get('traceId');
          })(),
          (async () => {
            await delay(15);
            return RequestContext.current()?.get('traceId');
          })(),
        ]);

        expect(results).toEqual(['parallel-trace', 'parallel-trace', 'parallel-trace']);
      });
    });

    it('should propagate through Promise.race()', async () => {
      await RequestContext.run({ traceId: 'race-trace' }, async () => {
        const result = await Promise.race([
          (async () => {
            await delay(10);
            return RequestContext.current()?.get('traceId');
          })(),
          (async () => {
            await delay(20);
            return RequestContext.current()?.get('traceId');
          })(),
        ]);

        expect(result).toBe('race-trace');
      });
    });
  });

  // ============================================================================
  // Timer/Callback Propagation
  // ============================================================================

  describe('Timer/Callback Propagation', () => {
    it('should propagate through setTimeout', async () => {
      let capturedTraceId: string | undefined;

      await RequestContext.run({ traceId: 'timeout-trace' }, async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            const ctx = RequestContext.current();
            capturedTraceId = ctx?.get('traceId');
            resolve();
          }, 10);
        });
      });

      expect(capturedTraceId).toBe('timeout-trace');
    });

    it('should propagate through setImmediate', async () => {
      let capturedTraceId: string | undefined;

      await RequestContext.run({ traceId: 'immediate-trace' }, async () => {
        await new Promise<void>((resolve) => {
          setImmediate(() => {
            const ctx = RequestContext.current();
            capturedTraceId = ctx?.get('traceId');
            resolve();
          });
        });
      });

      expect(capturedTraceId).toBe('immediate-trace');
    });

    it('should propagate through process.nextTick', async () => {
      let capturedTraceId: string | undefined;

      await RequestContext.run({ traceId: 'nexttick-trace' }, async () => {
        await new Promise<void>((resolve) => {
          process.nextTick(() => {
            const ctx = RequestContext.current();
            capturedTraceId = ctx?.get('traceId');
            resolve();
          });
        });
      });

      expect(capturedTraceId).toBe('nexttick-trace');
    });
  });

  // ============================================================================
  // Nested Function Propagation
  // ============================================================================

  describe('Nested Function Propagation', () => {
    async function innerAsync(): Promise<string | undefined> {
      return RequestContext.current()?.get('traceId');
    }

    async function middleAsync(): Promise<string | undefined> {
      await delay(5);
      return innerAsync();
    }

    async function outerAsync(): Promise<string | undefined> {
      await delay(5);
      return middleAsync();
    }

    it('should propagate through nested async functions', async () => {
      const result = await RequestContext.run({ traceId: 'nested-trace' }, async () => {
        return outerAsync();
      });

      expect(result).toBe('nested-trace');
    });

    it('should propagate through deeply nested calls', async () => {
      const depth = 10;

      async function recurse(n: number): Promise<string | undefined> {
        if (n <= 0) {
          return RequestContext.current()?.get('traceId');
        }
        await delay(1);
        return recurse(n - 1);
      }

      const result = await RequestContext.run({ traceId: 'deep-trace' }, async () =>
        recurse(depth),
      );

      expect(result).toBe('deep-trace');
    });
  });

  // ============================================================================
  // Concurrent Request Isolation
  // ============================================================================

  describe('Concurrent Request Isolation', () => {
    it('should isolate context between concurrent requests', async () => {
      const results: Array<{ request: string; captured: string | undefined }> = [];

      const simulateRequest = async (requestId: string): Promise<void> => {
        await RequestContext.run({ traceId: `trace-${requestId}` }, async () => {
          // Simulate some async work
          await delay(Math.random() * 20);

          const ctx = RequestContext.current();
          results.push({
            request: requestId,
            captured: ctx?.get('traceId'),
          });
        });
      };

      // Start 5 concurrent requests
      await Promise.all([
        simulateRequest('A'),
        simulateRequest('B'),
        simulateRequest('C'),
        simulateRequest('D'),
        simulateRequest('E'),
      ]);

      // Each request should have captured its own trace ID
      for (const result of results) {
        expect(result.captured).toBe(`trace-${result.request}`);
      }
    });

    it('should handle interleaved async operations', async () => {
      const log: string[] = [];

      const task = async (id: string): Promise<void> => {
        await RequestContext.run({ traceId: id }, async () => {
          log.push(`${id}-start`);
          await delay(10);

          const mid = RequestContext.current()?.get('traceId');
          log.push(`${id}-mid-${mid}`);
          await delay(10);

          const end = RequestContext.current()?.get('traceId');
          log.push(`${id}-end-${end}`);
        });
      };

      await Promise.all([task('A'), task('B')]);

      // Verify each task maintained its own context
      const aEntries = log.filter((l) => l.startsWith('A'));
      const bEntries = log.filter((l) => l.startsWith('B'));

      expect(aEntries).toContain('A-mid-A');
      expect(aEntries).toContain('A-end-A');
      expect(bEntries).toContain('B-mid-B');
      expect(bEntries).toContain('B-end-B');
    });
  });

  // ============================================================================
  // Context Modification Tests
  // ============================================================================

  describe('Context Modification', () => {
    it('should allow modification within scope', async () => {
      await RequestContext.run({ traceId: 'initial' }, async () => {
        const ctx = RequestContext.current()!;

        ctx.set(OPERATION_KEY, 'step1');
        expect(ctx.get(OPERATION_KEY)).toBe('step1');

        await delay(10);

        ctx.set(OPERATION_KEY, 'step2');
        expect(ctx.get(OPERATION_KEY)).toBe('step2');
      });
    });

    it('should share modifications across async boundaries', async () => {
      await RequestContext.run({}, async () => {
        const ctx1 = RequestContext.current()!;
        ctx1.set(DEPTH_KEY, 1);

        await delay(10);

        const ctx2 = RequestContext.current()!;
        expect(ctx2.get(DEPTH_KEY)).toBe(1);

        ctx2.set(DEPTH_KEY, 2);

        await delay(10);

        const ctx3 = RequestContext.current()!;
        expect(ctx3.get(DEPTH_KEY)).toBe(2);
      });
    });
  });

  // ============================================================================
  // RequestContextProxy Tests
  // ============================================================================

  describe('RequestContextProxy', () => {
    it('should lazily resolve context (Debug Version)', () => {
      const proxy = RequestContextProxy.lazy();

      RequestContext.run({}, () => {
        const ctx = RequestContext.current()!;
        ctx.set(TRACE_ID_KEY, 'lazy-trace');

        expect(proxy.get(TRACE_ID_KEY)).toBe('lazy-trace');
      });
    });

    it('should return defaults when no context', () => {
      const proxy = RequestContextProxy.lazy({
        defaults: {
          traceId: 'default-trace',
          userId: 'default-user',
        },
      });

      expect(proxy.get('traceId')).toBe('default-trace');
      expect(proxy.get('userId')).toBe('default-user');
    });

    it('should return ContextKey defaultValue when no context', () => {
      const proxy = RequestContextProxy.lazy();

      // DEPTH_KEY has defaultValue of 0
      expect(proxy.get(DEPTH_KEY)).toBe(0);
    });

    it('should throw in strict mode when no context', () => {
      const proxy = RequestContextProxy.lazy({
        strict: true,
        strictMessage: 'Custom error message',
      });

      expect(() => proxy.get(TRACE_ID_KEY)).toThrow('Custom error message');
    });

    it('should cache context after first resolution', () => {
      const proxy = RequestContextProxy.lazy() as unknown as IContext<IStruktosContextData> & {
        _isResolved: boolean;
      };

      expect(proxy._isResolved).toBe(false);

      RequestContext.run({ traceId: 'cached' }, () => {
        proxy.get(TRACE_ID_KEY);
        expect(proxy._isResolved).toBe(true);
      });
    });

    describe('withDefaults', () => {
      it('should create context-like object with defaults', () => {
        const mock = RequestContextProxy.withDefaults({
          traceId: 'mock-trace',
          userId: 'mock-user',
        });

        expect(mock.get('traceId')).toBe('mock-trace');
        expect(mock.get('userId')).toBe('mock-user');
      });

      it('should allow modifications', () => {
        const mock = RequestContextProxy.withDefaults({
          traceId: 'initial',
        });

        mock.set(TRACE_ID_KEY, 'modified');
        expect(mock.get(TRACE_ID_KEY)).toBe('modified');
      });

      it('should support all IContext operations', () => {
        const mock = RequestContextProxy.withDefaults<IStruktosContextData>({
          traceId: 'test',
        });

        expect(mock.has('traceId')).toBe(true);
        expect(mock.has('nonexistent')).toBe(false);

        mock.delete('traceId');
        expect(mock.has('traceId')).toBe(false);

        mock.setAll({ userId: 'user', timestamp: 123 });

        const all = mock.getAll();
        expect(all['userId']).toBe('user');
        expect(all['timestamp']).toBe(123);
      });
    });
  });

  // ============================================================================
  // AutoContextBehavior Tests
  // ============================================================================

  describe('AutoContextBehavior', () => {
    it('should create context scope for handler', async () => {
      const behavior = new AutoContextBehavior();
      let capturedTraceId: string | undefined;

      await behavior.handle(
        { traceId: 'behavior-trace' },
        async () => {
          capturedTraceId = RequestContext.current()?.get('traceId');
          return 'result';
        },
        { context: {} as any },
      );

      expect(capturedTraceId).toBe('behavior-trace');
    });

    it('should extract context from request', async () => {
      const behavior = new AutoContextBehavior();

      await behavior.handle(
        {
          traceId: 'extracted-trace',
          userId: 'extracted-user',
          commandId: 'cmd-123',
        },
        async () => {
          const ctx = RequestContext.current()!;
          expect(ctx.get('traceId')).toBe('extracted-trace');
          expect(ctx.get('userId')).toBe('extracted-user');
          expect(ctx.get('requestId')).toBe('cmd-123');
        },
        { context: {} as any },
      );
    });

    it('should generate traceId if not provided', async () => {
      const behavior = new AutoContextBehavior();

      await behavior.handle(
        {}, // No traceId
        async () => {
          const ctx = RequestContext.current()!;
          const traceId = ctx.get('traceId');
          expect(traceId).toBeDefined();
          expect(typeof traceId).toBe('string');
        },
        { context: {} as any },
      );
    });

    it('should use custom traceId generator', async () => {
      const behavior = new AutoContextBehavior({
        generateTraceId: () => 'custom-generated-id',
      });

      await behavior.handle(
        {},
        async () => {
          const ctx = RequestContext.current()!;
          expect(ctx.get('traceId')).toBe('custom-generated-id');
        },
        { context: {} as any },
      );
    });

    it('should propagate AbortSignal cancellation', async () => {
      const behavior = new AutoContextBehavior({
        propagateCancellation: true,
      });

      const controller = new AbortController();
      let wasCancelled = false;

      await behavior.handle(
        {},
        async () => {
          const ctx = RequestContext.current()!;
          ctx.onCancel(() => {
            wasCancelled = true;
          });

          // Trigger abort
          controller.abort();

          await delay(10);
        },
        { context: {} as any, signal: controller.signal },
      );

      expect(wasCancelled).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty initial data', async () => {
      await RequestContext.run({}, async () => {
        const ctx = RequestContext.current();
        expect(ctx).toBeDefined();
        expect(Object.keys(ctx!.getAll()).length).toBe(0);
      });
    });

    it('should not leak context outside scope', async () => {
      await RequestContext.run({ traceId: 'internal' }, async () => {
        await delay(10);
      });

      // Outside scope
      expect(RequestContext.current()).toBeUndefined();
    });

    it('should handle error in callback', async () => {
      await expect(
        RequestContext.run({}, async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      // Context should still be cleaned up
      expect(RequestContext.current()).toBeUndefined();
    });

    it('should handle synchronous callback', () => {
      const result = RequestContext.run({ traceId: 'sync' }, () => {
        return RequestContext.current()?.get('traceId');
      });

      expect(result).toBe('sync');
    });
  });
});

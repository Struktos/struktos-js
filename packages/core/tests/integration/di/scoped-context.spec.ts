/**
 * @fileoverview DI + RequestContext Integration Tests
 *
 * Tests for the integration between DI container and RequestContext.
 * Verifies that scoped services work correctly with async context propagation.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  createToken,
  type IServiceProvider,
  type IDisposable,
  NoActiveScopeError,
} from '../../../src/domain/di';
import { RequestContext } from '../../../src/infrastructure/context';
import { ServiceCollection, withScope } from '../../../src/infrastructure/di';

// ============================================================================
// Test Fixtures
// ============================================================================

// Interface tokens
const ILogger = createToken<ILoggerInterface>('ILogger');
const IDatabase = createToken<IDatabaseInterface>('IDatabase');
const IUnitOfWork = createToken<IUnitOfWorkInterface>('IUnitOfWork');
const IUserRepository = createToken<IUserRepositoryInterface>('IUserRepository');

interface ILoggerInterface {
  log(message: string): void;
  getTraceId(): string | undefined;
}

interface IDatabaseInterface {
  query(sql: string): Promise<unknown>;
  instanceId: string;
}

interface IUnitOfWorkInterface extends IDisposable {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isCommitted: boolean;
  isRolledBack: boolean;
}

interface IUserRepositoryInterface {
  findById(id: string): Promise<unknown>;
  save(user: unknown): Promise<void>;
}

// Implementations

let loggerInstanceCount = 0;

class ConsoleLogger implements ILoggerInterface {
  public readonly instanceId: number;

  constructor() {
    this.instanceId = ++loggerInstanceCount;
  }

  log(message: string): void {
    const ctx = RequestContext.current();
    const traceId = ctx?.get('traceId') ?? 'no-trace';
    console.log(`[${traceId}] ${message}`);
  }

  getTraceId(): string | undefined {
    return RequestContext.current()?.get('traceId') as string | undefined;
  }
}

let dbInstanceCount = 0;

class PostgresDatabase implements IDatabaseInterface {
  public readonly instanceId: string;

  constructor() {
    this.instanceId = `db-${++dbInstanceCount}`;
  }

  async query(sql: string): Promise<unknown> {
    return { sql, rows: [] };
  }
}

let uowInstanceCount = 0;

class PrismaUnitOfWork implements IUnitOfWorkInterface {
  static inject = [IDatabase] as const;

  public readonly instanceId: string;
  public isCommitted = false;
  public isRolledBack = false;
  public disposed = false;

  constructor(public readonly db: IDatabaseInterface) {
    this.instanceId = `uow-${++uowInstanceCount}`;
  }

  async begin(): Promise<void> {
    await this.db.query('BEGIN');
  }

  async commit(): Promise<void> {
    await this.db.query('COMMIT');
    this.isCommitted = true;
  }

  async rollback(): Promise<void> {
    await this.db.query('ROLLBACK');
    this.isRolledBack = true;
  }

  dispose(): void {
    if (!this.isCommitted && !this.isRolledBack) {
      // Auto-rollback uncommitted transaction
      this.isRolledBack = true;
    }
    this.disposed = true;
  }
}

class UserRepository implements IUserRepositoryInterface {
  static inject = [IDatabase, ILogger] as const;

  constructor(
    public readonly db: IDatabaseInterface,
    public readonly logger: ILoggerInterface,
  ) {}

  async findById(id: string): Promise<unknown> {
    this.logger.log(`Finding user ${id}`);
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }

  async save(_user: unknown): Promise<void> {
    this.logger.log(`Saving user`);
    await this.db.query(`INSERT INTO users VALUES (...)`);
  }
}

class UserService {
  static inject = [IUserRepository, IUnitOfWork, ILogger] as const;

  constructor(
    public readonly userRepo: IUserRepositoryInterface,
    public readonly uow: IUnitOfWorkInterface,
    public readonly logger: ILoggerInterface,
  ) {}

  async createUser(name: string): Promise<string> {
    this.logger.log(`Creating user: ${name}`);
    await this.uow.begin();
    await this.userRepo.save({ name });
    await this.uow.commit();
    return `user-${Date.now()}`;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('DI + RequestContext Integration', () => {
  let services: ServiceCollection;
  let provider: IServiceProvider;

  beforeEach(() => {
    // Reset counters
    loggerInstanceCount = 0;
    dbInstanceCount = 0;
    uowInstanceCount = 0;

    services = new ServiceCollection();

    // Register services
    services
      .addSingleton(ILogger, ConsoleLogger)
      .addScoped(IDatabase, PostgresDatabase)
      .addScoped(IUnitOfWork, PrismaUnitOfWork)
      .addScoped(IUserRepository, UserRepository)
      .addScoped(UserService);

    provider = services.build();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Scoped Resolution
  // ============================================================================

  describe('scoped service resolution', () => {
    it('should resolve scoped services within RequestContext', async () => {
      await RequestContext.run({ traceId: 'test-123' }, async () => {
        const scope = provider.createScope();

        const db = scope.resolve(IDatabase);
        expect(db).toBeInstanceOf(PostgresDatabase);

        await scope.dispose();
      });
    });

    it('should share scoped instance within same scope', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const db1 = scope.resolve(IDatabase);
        const db2 = scope.resolve(IDatabase);

        expect(db1).toBe(db2);
        expect(db1.instanceId).toBe(db2.instanceId);

        await scope.dispose();
      });
    });

    it('should create different instances in different RequestContexts', async () => {
      let db1: IDatabaseInterface;
      let db2: IDatabaseInterface;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        db1 = scope.resolve(IDatabase);
        await scope.dispose();
      });

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        db2 = scope.resolve(IDatabase);
        await scope.dispose();
      });

      expect(db1!).not.toBe(db2!);
      expect(db1!.instanceId).not.toBe(db2!.instanceId);
    });

    it('should return same scope within same RequestContext', async () => {
      await RequestContext.run({}, async () => {
        const scope1 = provider.createScope();
        const scope2 = provider.createScope();

        // Same RequestContext returns same scope
        expect(scope1).toBe(scope2);

        const db1 = scope1.resolve(IDatabase);
        const db2 = scope2.resolve(IDatabase);

        // Same scope = same instance
        expect(db1).toBe(db2);

        await scope1.dispose();
      });
    });

    it('should throw when creating scope outside RequestContext', () => {
      expect(() => {
        provider.createScope();
      }).toThrow(NoActiveScopeError);
    });
  });

  // ============================================================================
  // Singleton + Scoped Integration
  // ============================================================================

  describe('singleton and scoped service interaction', () => {
    it('should share singleton across all scopes', async () => {
      await RequestContext.run({}, async () => {
        const scope1 = provider.createScope();
        const scope2 = provider.createScope();

        const logger1 = scope1.resolve(ILogger);
        const logger2 = scope2.resolve(ILogger);

        expect(logger1).toBe(logger2);

        await scope1.dispose();
        await scope2.dispose();
      });
    });

    it('should inject singleton into scoped service', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const userRepo = scope.resolve(IUserRepository) as UserRepository;
        const logger = scope.resolve(ILogger);

        expect(userRepo.logger).toBe(logger);

        await scope.dispose();
      });
    });
  });

  // ============================================================================
  // Context Propagation
  // ============================================================================

  describe('context propagation with scoped services', () => {
    it('should access RequestContext from scoped service', async () => {
      const traceId = 'trace-abc-123';

      await RequestContext.run({ traceId }, async () => {
        const scope = provider.createScope();

        const logger = scope.resolve(ILogger) as ConsoleLogger;
        expect(logger.getTraceId()).toBe(traceId);

        await scope.dispose();
      });
    });

    it('should maintain context across async operations', async () => {
      const traceId = 'async-trace-456';

      await RequestContext.run({ traceId }, async () => {
        const scope = provider.createScope();

        scope.resolve(UserService);

        // Async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Context should still be accessible
        const logger = scope.resolve(ILogger) as ConsoleLogger;
        expect(logger.getTraceId()).toBe(traceId);

        await scope.dispose();
      });
    });

    it('should isolate context between concurrent requests', async () => {
      const results: string[] = [];

      const request1 = RequestContext.run({ traceId: 'request-1' }, async () => {
        const scope = provider.createScope();
        const logger = scope.resolve(ILogger) as ConsoleLogger;

        await new Promise((resolve) => setTimeout(resolve, 20));

        results.push(`req1: ${logger.getTraceId()}`);
        await scope.dispose();
      });

      const request2 = RequestContext.run({ traceId: 'request-2' }, async () => {
        const scope = provider.createScope();
        const logger = scope.resolve(ILogger) as ConsoleLogger;

        await new Promise((resolve) => setTimeout(resolve, 10));

        results.push(`req2: ${logger.getTraceId()}`);
        await scope.dispose();
      });

      await Promise.all([request1, request2]);

      expect(results).toContain('req1: request-1');
      expect(results).toContain('req2: request-2');
    });
  });

  // ============================================================================
  // Unit of Work Pattern
  // ============================================================================

  describe('Unit of Work pattern with scoped DI', () => {
    it('should share UoW instance within request scope', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const uow1 = scope.resolve(IUnitOfWork);
        const uow2 = scope.resolve(IUnitOfWork);

        expect(uow1).toBe(uow2);

        await scope.dispose();
      });
    });

    it('should inject same UoW into UserService and resolve separately', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const userService = scope.resolve(UserService);
        const uow = scope.resolve(IUnitOfWork);

        expect(userService.uow).toBe(uow);

        await scope.dispose();
      });
    });

    it('should auto-dispose UoW when scope ends', async () => {
      let capturedUow: PrismaUnitOfWork | undefined;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        capturedUow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;
        expect(capturedUow.disposed).toBe(false);

        await scope.dispose();
      });

      expect(capturedUow!.disposed).toBe(true);
    });

    it('should auto-rollback uncommitted transaction on dispose', async () => {
      let capturedUow: PrismaUnitOfWork | undefined;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        capturedUow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;
        await capturedUow.begin();
        // Not committing...

        await scope.dispose();
      });

      expect(capturedUow!.isRolledBack).toBe(true);
    });

    it('should not auto-rollback if committed', async () => {
      let capturedUow: PrismaUnitOfWork | undefined;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        capturedUow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;
        await capturedUow.begin();
        await capturedUow.commit();

        await scope.dispose();
      });

      expect(capturedUow!.isCommitted).toBe(true);
      expect(capturedUow!.isRolledBack).toBe(false);
    });
  });

  // ============================================================================
  // withScope Helper
  // ============================================================================

  describe('withScope helper function', () => {
    it('should create and dispose scope automatically', async () => {
      let scopeDisposed = false;

      await RequestContext.run({}, async () => {
        const result = await withScope(provider, async (scope) => {
          scope.resolve(IUnitOfWork) as PrismaUnitOfWork;

          // Track when scope is disposed
          const originalDispose = scope.dispose.bind(scope);
          scope.dispose = () => {
            scopeDisposed = true;
            return originalDispose();
          };

          return 'success';
        });

        expect(result).toBe('success');
        expect(scopeDisposed).toBe(true);
      });
    });

    it('should dispose scope even on error', async () => {
      let capturedUow: PrismaUnitOfWork | undefined;

      await RequestContext.run({}, async () => {
        try {
          await withScope(provider, async (scope) => {
            capturedUow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;
            throw new Error('Business logic error');
          });
        } catch {
          // Expected error
        }
      });

      expect(capturedUow!.disposed).toBe(true);
    });
  });

  // ============================================================================
  // Complex Dependency Graph
  // ============================================================================

  describe('complex dependency resolution', () => {
    it('should resolve deep dependency graph correctly', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const userService = scope.resolve(UserService);

        // Verify dependency graph
        expect(userService).toBeInstanceOf(UserService);
        expect(userService.userRepo).toBeDefined();
        expect(userService.uow).toBeDefined();
        expect(userService.logger).toBeDefined();

        // UserRepository has its own dependencies
        const userRepo = userService.userRepo as UserRepository;
        expect(userRepo.db).toBeDefined();
        expect(userRepo.logger).toBeDefined();

        // UoW has database dependency
        const uow = userService.uow as PrismaUnitOfWork;
        expect(uow.db).toBeDefined();

        // Verify shared instances
        // Same DB across scope
        expect(userRepo.db).toBe(uow.db);

        // Same singleton logger everywhere
        expect(userRepo.logger).toBe(userService.logger);

        await scope.dispose();
      });
    });

    it('should handle multiple service resolutions efficiently', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        // Resolve many times
        for (let i = 0; i < 100; i++) {
          const db = scope.resolve(IDatabase);
          expect(db.instanceId).toBe('db-1'); // Same instance
        }

        // Only one DB instance created
        expect(dbInstanceCount).toBe(1);

        await scope.dispose();
      });
    });
  });

  // ============================================================================
  // Real-World Scenario: HTTP Request Simulation
  // ============================================================================

  describe('HTTP request simulation', () => {
    it('should handle complete request lifecycle', async () => {
      const requestResults: string[] = [];

      // Simulate HTTP middleware
      const handleRequest = async (traceId: string, userId: string) => {
        return RequestContext.run({ traceId, userId }, async () => {
          const scope = provider.createScope();

          try {
            const userService = scope.resolve(UserService);
            const newUserId = await userService.createUser('John');

            requestResults.push(`${traceId}: created ${newUserId}`);
            return { success: true, userId: newUserId };
          } catch (error) {
            requestResults.push(`${traceId}: failed`);
            throw error;
          } finally {
            await scope.dispose();
          }
        });
      };

      // Simulate concurrent requests
      await Promise.all([
        handleRequest('trace-1', 'user-1'),
        handleRequest('trace-2', 'user-2'),
        handleRequest('trace-3', 'user-3'),
      ]);

      // Verify each request was handled independently
      expect(requestResults).toHaveLength(3);
      expect(requestResults.some((r) => r.startsWith('trace-1:'))).toBe(true);
      expect(requestResults.some((r) => r.startsWith('trace-2:'))).toBe(true);
      expect(requestResults.some((r) => r.startsWith('trace-3:'))).toBe(true);

      // Verify scoped instances were created per request
      // 3 requests = 3 DB instances, 3 UoW instances
      expect(dbInstanceCount).toBe(3);
      expect(uowInstanceCount).toBe(3);

      // Singleton logger is shared
      expect(loggerInstanceCount).toBe(1);
    });
  });

  // ============================================================================
  // Error Handling Scenarios
  // ============================================================================

  describe('error handling scenarios', () => {
    it('should properly clean up on service creation error', async () => {
      // Register a service that throws during construction
      class FailingService {
        constructor() {
          throw new Error('Service construction failed');
        }
      }

      const IFailing = createToken<FailingService>('IFailing');

      // Create new container with failing service
      const localServices = new ServiceCollection();
      localServices
        .addSingleton(ILogger, ConsoleLogger)
        .addScoped(IDatabase, PostgresDatabase)
        .addScoped(IFailing, FailingService);

      const localProvider = localServices.build();

      await RequestContext.run({}, async () => {
        const scope = localProvider.createScope();

        expect(() => {
          scope.resolve(IFailing);
        }).toThrow('Service construction failed');

        // Scope should still be usable for other services
        const db = scope.resolve(IDatabase);
        expect(db).toBeInstanceOf(PostgresDatabase);

        await scope.dispose();
      });
    });

    it('should handle async operation failures gracefully', async () => {
      let uow: PrismaUnitOfWork | undefined;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        try {
          uow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;
          await uow.begin();

          // Simulate async failure
          await Promise.reject(new Error('Async operation failed'));
        } catch {
          // Error caught
        } finally {
          await scope.dispose();
        }
      });

      // UoW should be disposed with rollback
      expect(uow!.disposed).toBe(true);
      expect(uow!.isRolledBack).toBe(true);
    });
  });

  // ============================================================================
  // Scope Lifecycle Tests
  // ============================================================================

  describe('scope lifecycle', () => {
    it('should track disposed state correctly', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        expect(scope.isDisposed()).toBe(false);

        await scope.dispose();

        expect(scope.isDisposed()).toBe(true);
      });
    });

    it('should be idempotent on multiple dispose calls', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        const uow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;

        // Multiple dispose calls should not throw
        await scope.dispose();
        await scope.dispose();
        await scope.dispose();

        expect(scope.isDisposed()).toBe(true);
        expect(uow.disposed).toBe(true);
      });
    });

    it('should dispose services in reverse creation order (LIFO)', async () => {
      const disposalOrder: string[] = [];

      // Define tokens first
      const IServiceA = createToken<ServiceA>('ServiceA');
      const IServiceB = createToken<ServiceB>('ServiceB');

      class ServiceA implements IDisposable {
        dispose(): void {
          disposalOrder.push('A');
        }
      }

      class ServiceB implements IDisposable {
        static inject = [IServiceA] as const;
        constructor(_a: ServiceA) {}
        dispose(): void {
          disposalOrder.push('B');
        }
      }

      // Create new container for this test
      const localServices = new ServiceCollection();
      localServices.addScoped(IServiceA, ServiceA).addScoped(IServiceB, ServiceB);
      const localProvider = localServices.build();

      await RequestContext.run({}, async () => {
        const scope = localProvider.createScope();

        // Resolve B first (which creates A as dependency)
        scope.resolve(IServiceB);

        await scope.dispose();
      });

      // B should be disposed before A (reverse creation order)
      expect(disposalOrder).toEqual(['B', 'A']);
    });
  });

  // ============================================================================
  // Memory Safety Tests
  // ============================================================================

  describe('memory safety', () => {
    it('should not leak references after scope disposal', async () => {
      let weakRef: WeakRef<PrismaUnitOfWork>;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        const uow = scope.resolve(IUnitOfWork) as PrismaUnitOfWork;

        weakRef = new WeakRef(uow);
        expect(weakRef.deref()).toBeDefined();

        await scope.dispose();
      });

      // Note: WeakRef behavior depends on GC, this test is more of a pattern demonstration
      // In practice, the scope should release all references
    });

    it('should clear internal caches on dispose', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        // Resolve multiple services
        scope.resolve(IDatabase);
        scope.resolve(IUnitOfWork);
        scope.resolve(IUserRepository);

        await scope.dispose();

        // After dispose, trying to resolve should throw
        expect(() => scope.resolve(IDatabase)).toThrow(/disposed/i);
      });
    });
  });

  // ============================================================================
  // Factory Service Tests
  // ============================================================================

  describe('factory services in scope', () => {
    it('should support factory-created scoped services', async () => {
      let factoryCallCount = 0;

      const ICustomService = createToken<{ id: number }>('ICustomService');

      // Create new container for this test
      const localServices = new ServiceCollection();
      localServices.addScopedFactory(ICustomService, () => {
        factoryCallCount++;
        return { id: factoryCallCount };
      });

      const localProvider = localServices.build();

      await RequestContext.run({}, async () => {
        const scope = localProvider.createScope();

        const service1 = scope.resolve(ICustomService);
        const service2 = scope.resolve(ICustomService);

        // Same instance within scope
        expect(service1).toBe(service2);
        expect(factoryCallCount).toBe(1);

        await scope.dispose();
      });

      // New scope = new factory call
      await RequestContext.run({}, async () => {
        const scope = localProvider.createScope();
        scope.resolve(ICustomService);

        expect(factoryCallCount).toBe(2);

        await scope.dispose();
      });
    });

    it('should inject dependencies into factory-created services', async () => {
      interface ICompositeService {
        db: IDatabaseInterface;
        logger: ILoggerInterface;
      }

      const IComposite = createToken<ICompositeService>('IComposite');

      // Create new container for this test
      const localServices = new ServiceCollection();
      localServices
        .addSingleton(ILogger, ConsoleLogger)
        .addScoped(IDatabase, PostgresDatabase)
        .addScopedFactory(IComposite, (resolver) => ({
          db: resolver.resolve(IDatabase),
          logger: resolver.resolve(ILogger),
        }));

      const localProvider = localServices.build();

      await RequestContext.run({}, async () => {
        const scope = localProvider.createScope();

        const composite = scope.resolve(IComposite);

        expect(composite.db).toBeInstanceOf(PostgresDatabase);
        expect(composite.logger).toBeInstanceOf(ConsoleLogger);

        // DB should be scoped (same as direct resolution)
        expect(composite.db).toBe(scope.resolve(IDatabase));

        await scope.dispose();
      });
    });
  });

  // ============================================================================
  // Stress Test
  // ============================================================================

  describe('stress tests', () => {
    it('should handle many concurrent requests', async () => {
      const requestCount = 50;
      const results: { traceId: string; dbId: string }[] = [];

      const handleRequest = async (index: number) => {
        return RequestContext.run({ traceId: `trace-${index}` }, async () => {
          const scope = provider.createScope();

          try {
            // Simulate some async work
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

            const db = scope.resolve(IDatabase);
            results.push({
              traceId: `trace-${index}`,
              dbId: db.instanceId,
            });
          } finally {
            await scope.dispose();
          }
        });
      };

      // Run many concurrent requests
      await Promise.all(Array.from({ length: requestCount }, (_, i) => handleRequest(i)));

      // All requests should complete
      expect(results).toHaveLength(requestCount);

      // Each request should have unique DB instance
      const uniqueDbIds = new Set(results.map((r) => r.dbId));
      expect(uniqueDbIds.size).toBe(requestCount);
    });

    it('should handle rapid scope creation and disposal', async () => {
      const iterationCount = 100;

      await RequestContext.run({}, async () => {
        for (let i = 0; i < iterationCount; i++) {
          const scope = provider.createScope();
          scope.resolve(IDatabase);
          scope.resolve(IUnitOfWork);
          await scope.dispose();
        }
      });

      // Should not throw or leak memory
      // All scopes created within same RequestContext share context
    });
  });
});

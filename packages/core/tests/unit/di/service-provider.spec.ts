/**
 * @fileoverview ServiceProvider Unit Tests
 *
 * Tests for the dependency resolution engine.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createToken,
  ServiceNotRegisteredError,
  CircularDependencyError,
  ScopeMismatchError,
  NoActiveScopeError,
  type IServiceProvider,
  type IDisposable,
} from '../../../src/domain/di';
import { RequestContext } from '../../../src/infrastructure/context';
import { ServiceCollection } from '../../../src/infrastructure/di';

// ============================================================================
// Test Fixtures
// ============================================================================

// Interface tokens
const ILogger = createToken<ILoggerInterface>('ILogger');
const IDatabase = createToken<IDatabaseInterface>('IDatabase');
const IConfig = createToken<IConfigInterface>('IConfig');

interface ILoggerInterface {
  log(message: string): void;
}

interface IDatabaseInterface {
  query(sql: string): Promise<unknown>;
}

interface IConfigInterface {
  port: number;
  dbUrl: string;
}

// Concrete implementations
class ConsoleLogger implements ILoggerInterface {
  log(message: string): void {
    console.log(message);
  }
}

class PostgresDatabase implements IDatabaseInterface {
  async query(sql: string): Promise<unknown> {
    return { sql, result: [] };
  }
}

class ConfigService implements IConfigInterface {
  port = 3000;
  dbUrl = 'postgres://localhost/test';
}

// Service with dependencies
class UserService {
  static inject = [ILogger, IDatabase] as const;

  constructor(
    public readonly logger: ILoggerInterface,
    public readonly db: IDatabaseInterface,
  ) {}
}

// Service with nested dependencies
class OrderService {
  static inject = [UserService, ILogger] as const;

  constructor(
    public readonly userService: UserService,
    public readonly logger: ILoggerInterface,
  ) {}
}

// Disposable service
class DisposableService implements IDisposable {
  disposed = false;

  dispose(): void {
    this.disposed = true;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ServiceProvider', () => {
  let services: ServiceCollection;
  let provider: IServiceProvider;

  beforeEach(() => {
    services = new ServiceCollection();
  });

  // ============================================================================
  // Basic Resolution Tests
  // ============================================================================

  describe('resolve - basic', () => {
    it('should resolve singleton service', () => {
      services.addSingleton(ConfigService);
      provider = services.build();

      const config = provider.resolve(ConfigService);

      expect(config).toBeInstanceOf(ConfigService);
      expect(config.port).toBe(3000);
    });

    it('should resolve interface-to-implementation', () => {
      services.addSingleton(ILogger, ConsoleLogger);
      provider = services.build();

      const logger = provider.resolve(ILogger);

      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should resolve factory-based service', () => {
      services.addSingletonFactory(IConfig, () => ({
        port: 8080,
        dbUrl: 'test-url',
      }));
      provider = services.build();

      const config = provider.resolve(IConfig);

      expect(config.port).toBe(8080);
      expect(config.dbUrl).toBe('test-url');
    });

    it('should resolve instance registration', () => {
      const instance = new ConfigService();
      instance.port = 9000;

      services.addSingletonInstance(ConfigService, instance);
      provider = services.build();

      const config = provider.resolve(ConfigService);

      expect(config).toBe(instance);
      expect(config.port).toBe(9000);
    });
  });

  // ============================================================================
  // Dependency Injection Tests
  // ============================================================================

  describe('resolve - dependencies', () => {
    it('should inject dependencies from static inject', () => {
      services
        .addSingleton(ILogger, ConsoleLogger)
        .addSingleton(IDatabase, PostgresDatabase)
        .addSingleton(UserService);

      provider = services.build();

      const userService = provider.resolve(UserService);

      expect(userService).toBeInstanceOf(UserService);
      expect(userService.logger).toBeInstanceOf(ConsoleLogger);
      expect(userService.db).toBeInstanceOf(PostgresDatabase);
    });

    it('should inject nested dependencies', () => {
      services
        .addSingleton(ILogger, ConsoleLogger)
        .addSingleton(IDatabase, PostgresDatabase)
        .addSingleton(UserService)
        .addSingleton(OrderService);

      provider = services.build();

      const orderService = provider.resolve(OrderService);

      expect(orderService.userService).toBeInstanceOf(UserService);
      expect(orderService.logger).toBeInstanceOf(ConsoleLogger);
      expect(orderService.userService.db).toBeInstanceOf(PostgresDatabase);
    });

    it('should resolve factory dependencies', () => {
      services.addSingleton(IConfig, ConfigService).addSingletonFactory(ILogger, (resolver) => {
        resolver.resolve(IConfig);
        return new ConsoleLogger();
      });

      provider = services.build();

      const logger = provider.resolve(ILogger);
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });
  });

  // ============================================================================
  // Singleton Caching Tests
  // ============================================================================

  describe('singleton caching', () => {
    it('should return same instance for singleton', () => {
      services.addSingleton(ConfigService);
      provider = services.build();

      const config1 = provider.resolve(ConfigService);
      const config2 = provider.resolve(ConfigService);

      expect(config1).toBe(config2);
    });

    it('should share singleton across resolutions', () => {
      services
        .addSingleton(ILogger, ConsoleLogger)
        .addSingleton(IDatabase, PostgresDatabase)
        .addSingleton(UserService);

      provider = services.build();

      const userService = provider.resolve(UserService);
      const logger = provider.resolve(ILogger);

      expect(userService.logger).toBe(logger);
    });
  });

  // ============================================================================
  // Transient Tests
  // ============================================================================

  describe('transient resolution', () => {
    it('should create new instance each time', () => {
      services.addTransient(ConfigService);
      provider = services.build();

      const config1 = provider.resolve(ConfigService);
      const config2 = provider.resolve(ConfigService);

      expect(config1).not.toBe(config2);
    });
  });

  // ============================================================================
  // Scoped Resolution Tests
  // ============================================================================

  describe('scoped resolution', () => {
    beforeEach(() => {
      services
        .addSingleton(ILogger, ConsoleLogger)
        .addScoped(IDatabase, PostgresDatabase)
        .addScoped(UserService);

      provider = services.build();
    });

    it('should throw NoActiveScopeError without RequestContext', () => {
      expect(() => {
        provider.createScope();
      }).toThrow(NoActiveScopeError);
    });

    it('should create scope inside RequestContext', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        expect(scope).toBeDefined();
        await scope.dispose();
      });
    });

    it('should cache scoped service within scope', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const db1 = scope.resolve(IDatabase);
        const db2 = scope.resolve(IDatabase);

        expect(db1).toBe(db2);

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

      // Different RequestContexts = different scopes = different instances
      expect(db1!).not.toBe(db2!);
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

    it('should share singleton across scopes', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const logger1 = scope.resolve(ILogger);
        const logger2 = scope.resolve(ILogger);

        expect(logger1).toBe(logger2);

        await scope.dispose();
      });
    });

    it('should share singleton between provider and scope', async () => {
      // Singleton resolved from root provider
      const rootLogger = provider.resolve(ILogger);

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        // Singleton resolved from scope
        const scopeLogger = scope.resolve(ILogger);

        expect(scopeLogger).toBe(rootLogger);

        await scope.dispose();
      });
    });

    it('should inject scoped into scoped', async () => {
      await RequestContext.run({}, async () => {
        const scope = provider.createScope();

        const userService = scope.resolve(UserService);

        expect(userService.db).toBeInstanceOf(PostgresDatabase);

        await scope.dispose();
      });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should throw ServiceNotRegisteredError for unregistered service', () => {
      provider = services.build();

      expect(() => {
        provider.resolve(ILogger);
      }).toThrow(ServiceNotRegisteredError);
    });

    it('should include resolution path in error', () => {
      services.addSingleton(UserService); // Missing ILogger and IDatabase

      provider = services.build();

      try {
        provider.resolve(UserService);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceNotRegisteredError);
        expect((error as ServiceNotRegisteredError).resolutionPath).toContain('UserService');
      }
    });
  });

  // ============================================================================
  // Circular Dependency Tests
  // ============================================================================

  describe('circular dependency detection', () => {
    it('should detect direct circular dependency', () => {
      // A -> B -> A
      const IServiceA = createToken('IServiceA');
      const IServiceB = createToken('IServiceB');

      class ServiceA {
        static inject = [IServiceB] as const;
        constructor(public b: unknown) {}
      }

      class ServiceB {
        static inject = [IServiceA] as const;
        constructor(public a: unknown) {}
      }

      services.addSingleton(IServiceA, ServiceA).addSingleton(IServiceB, ServiceB);

      provider = services.build();

      expect(() => {
        provider.resolve(IServiceA);
      }).toThrow(CircularDependencyError);
    });

    it('should detect indirect circular dependency', () => {
      // A -> B -> C -> A
      const IServiceA = createToken('IServiceA');
      const IServiceB = createToken('IServiceB');
      const IServiceC = createToken('IServiceC');

      class ServiceA {
        static inject = [IServiceB] as const;
        constructor(public b: unknown) {}
      }

      class ServiceB {
        static inject = [IServiceC] as const;
        constructor(public c: unknown) {}
      }

      class ServiceC {
        static inject = [IServiceA] as const;
        constructor(public a: unknown) {}
      }

      services
        .addSingleton(IServiceA, ServiceA)
        .addSingleton(IServiceB, ServiceB)
        .addSingleton(IServiceC, ServiceC);

      provider = services.build();

      expect(() => {
        provider.resolve(IServiceA);
      }).toThrow(CircularDependencyError);
    });

    it('should include cycle path in error', () => {
      const IServiceA = createToken('IServiceA');
      const IServiceB = createToken('IServiceB');

      class ServiceA {
        static inject = [IServiceB] as const;
        constructor(public b: unknown) {}
      }

      class ServiceB {
        static inject = [IServiceA] as const;
        constructor(public a: unknown) {}
      }

      services.addSingleton(IServiceA, ServiceA).addSingleton(IServiceB, ServiceB);

      provider = services.build();

      try {
        provider.resolve(IServiceA);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const circularError = error as CircularDependencyError;
        expect(circularError.cyclePath).toContain('Symbol(IServiceA)');
        expect(circularError.cyclePath).toContain('Symbol(IServiceB)');
      }
    });
  });

  // ============================================================================
  // Scope Mismatch Tests
  // ============================================================================

  describe('scope mismatch validation', () => {
    it('should throw ScopeMismatchError for Singleton -> Scoped', () => {
      class SingletonService {
        static inject = [IDatabase] as const;
        constructor(public db: IDatabaseInterface) {}
      }

      services.addScoped(IDatabase, PostgresDatabase).addSingleton(SingletonService);

      expect(() => {
        services.build({ validateScopes: true });
      }).toThrow(ScopeMismatchError);
    });

    it('should allow Scoped -> Singleton', async () => {
      class ScopedService {
        static inject = [ILogger] as const;
        constructor(public logger: ILoggerInterface) {}
      }

      services.addSingleton(ILogger, ConsoleLogger).addScoped(ScopedService);

      // Should not throw
      provider = services.build({ validateScopes: true });

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        const service = scope.resolve(ScopedService);
        expect(service.logger).toBeInstanceOf(ConsoleLogger);
        await scope.dispose();
      });
    });

    it('should skip validation when validateScopes is false', () => {
      class SingletonService {
        static inject = [IDatabase] as const;
        constructor(public db: IDatabaseInterface) {}
      }

      services.addScoped(IDatabase, PostgresDatabase).addSingleton(SingletonService);

      // Should not throw with validation disabled
      provider = services.build({ validateScopes: false });
      expect(provider).toBeDefined();
    });
  });

  // ============================================================================
  // tryResolve Tests
  // ============================================================================

  describe('tryResolve', () => {
    it('should return undefined for unregistered service', () => {
      provider = services.build();

      const result = provider.tryResolve(ILogger);

      expect(result).toBeUndefined();
    });

    it('should return instance for registered service', () => {
      services.addSingleton(ILogger, ConsoleLogger);
      provider = services.build();

      const result = provider.tryResolve(ILogger);

      expect(result).toBeInstanceOf(ConsoleLogger);
    });
  });

  // ============================================================================
  // isRegistered Tests
  // ============================================================================

  describe('isRegistered', () => {
    it('should return true for registered service', () => {
      services.addSingleton(ILogger, ConsoleLogger);
      provider = services.build();

      expect(provider.isRegistered(ILogger)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      provider = services.build();

      expect(provider.isRegistered(ILogger)).toBe(false);
    });
  });

  // ============================================================================
  // Disposal Tests
  // ============================================================================

  describe('dispose', () => {
    it('should dispose singleton services', async () => {
      const IDisposable = createToken<DisposableService>('IDisposable');
      services.addSingleton(IDisposable, DisposableService);
      provider = services.build();

      const instance = provider.resolve(IDisposable);
      expect(instance.disposed).toBe(false);

      await provider.dispose();

      expect(instance.disposed).toBe(true);
    });

    it('should dispose scoped services when scope ends', async () => {
      const IDisposable = createToken<DisposableService>('IDisposable');
      services.addScoped(IDisposable, DisposableService);
      provider = services.build();

      let instance: DisposableService;

      await RequestContext.run({}, async () => {
        const scope = provider.createScope();
        instance = scope.resolve(IDisposable);

        expect(instance.disposed).toBe(false);

        await scope.dispose();

        expect(instance.disposed).toBe(true);
      });
    });
  });
});

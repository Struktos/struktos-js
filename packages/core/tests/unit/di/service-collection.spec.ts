/**
 * @fileoverview ServiceCollection Unit Tests
 *
 * Tests for the service registration functionality.
 *
 * @license Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { ServiceLifetime, createToken, ContainerSealedError } from '../../../src/domain/di';
import { ServiceCollection, createServiceCollection } from '../../../src/infrastructure/di';

// ============================================================================
// Test Fixtures
// ============================================================================

// Interface tokens
const ILogger = createToken<ILoggerInterface>('ILogger');
const IDatabase = createToken<IDatabaseInterface>('IDatabase');

interface ILoggerInterface {
  log(message: string): void;
}

interface IDatabaseInterface {
  query(sql: string): Promise<unknown>;
}

// Concrete classes
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

class ConfigService {
  readonly port = 3000;
  readonly dbUrl = 'postgres://localhost/test';
}

class UserService {
  static inject = [ILogger, IDatabase] as const;

  constructor(
    private logger: ILoggerInterface,
    private db: IDatabaseInterface,
  ) {}

  async getUser(id: string): Promise<unknown> {
    this.logger.log(`Fetching user ${id}`);
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ServiceCollection', () => {
  let services: ServiceCollection;

  beforeEach(() => {
    services = new ServiceCollection();
  });

  // ============================================================================
  // Construction Tests
  // ============================================================================

  describe('construction', () => {
    it('should create empty collection', () => {
      expect(services.getDescriptors()).toHaveLength(0);
    });

    it('should create via factory function', () => {
      const collection = createServiceCollection();
      expect(collection).toBeInstanceOf(ServiceCollection);
    });
  });

  // ============================================================================
  // Singleton Registration Tests
  // ============================================================================

  describe('addSingleton', () => {
    it('should register self-registration (class only)', () => {
      services.addSingleton(ConfigService);

      expect(services.has(ConfigService)).toBe(true);

      const descriptors = services.getDescriptors();
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0]!.lifetime).toBe(ServiceLifetime.Singleton);
      expect(descriptors[0]!.implementationType).toBe(ConfigService);
    });

    it('should register interface-to-implementation', () => {
      services.addSingleton(ILogger, ConsoleLogger);

      expect(services.has(ILogger)).toBe(true);

      const descriptors = services.getDescriptors();
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0]!.lifetime).toBe(ServiceLifetime.Singleton);
      expect(descriptors[0]!.implementationType).toBe(ConsoleLogger);
    });

    it('should support fluent chaining', () => {
      const result = services.addSingleton(ConfigService).addSingleton(ILogger, ConsoleLogger);

      expect(result).toBe(services);
      expect(services.getDescriptors()).toHaveLength(2);
    });
  });

  describe('addSingletonFactory', () => {
    it('should register factory-based singleton', () => {
      const factory = () => ({
        log: (msg: string) => console.log(msg),
        port: 3000,
      });
      services.addSingletonFactory(ILogger, factory);

      expect(services.has(ILogger)).toBe(true);

      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor).toBeDefined();
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Singleton);
      expect(descriptor!.factory).toBe(factory);
      expect(descriptor!.implementationType).toBeUndefined();
    });
  });

  describe('addSingletonInstance', () => {
    it('should register pre-created instance', () => {
      const instance = new ConfigService();
      services.addSingletonInstance(ConfigService, instance);

      expect(services.has(ConfigService)).toBe(true);

      const descriptor = services.getDescriptor(ConfigService);
      expect(descriptor).toBeDefined();
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Singleton);
      expect(descriptor!.factory).toBeDefined();
    });
  });

  // ============================================================================
  // Scoped Registration Tests
  // ============================================================================

  describe('addScoped', () => {
    it('should register self-registration', () => {
      services.addScoped(UserService);

      expect(services.has(UserService)).toBe(true);

      const descriptor = services.getDescriptor(UserService);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Scoped);
    });

    it('should register interface-to-implementation', () => {
      services.addScoped(IDatabase, PostgresDatabase);

      expect(services.has(IDatabase)).toBe(true);

      const descriptor = services.getDescriptor(IDatabase);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Scoped);
      expect(descriptor!.implementationType).toBe(PostgresDatabase);
    });
  });

  describe('addScopedFactory', () => {
    it('should register factory-based scoped service', () => {
      const factory = () => new PostgresDatabase();
      services.addScopedFactory(IDatabase, factory);

      const descriptor = services.getDescriptor(IDatabase);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Scoped);
      expect(descriptor!.factory).toBe(factory);
    });
  });

  // ============================================================================
  // Transient Registration Tests
  // ============================================================================

  describe('addTransient', () => {
    it('should register self-registration', () => {
      services.addTransient(UserService);

      const descriptor = services.getDescriptor(UserService);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Transient);
    });

    it('should register interface-to-implementation', () => {
      services.addTransient(ILogger, ConsoleLogger);

      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Transient);
    });
  });

  describe('addTransientFactory', () => {
    it('should register factory-based transient service', () => {
      const factory = () => new ConsoleLogger();
      services.addTransientFactory(ILogger, factory);

      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor!.lifetime).toBe(ServiceLifetime.Transient);
      expect(descriptor!.factory).toBe(factory);
    });
  });

  // ============================================================================
  // Utility Method Tests
  // ============================================================================

  describe('has', () => {
    it('should return true for registered service', () => {
      services.addSingleton(ConfigService);
      expect(services.has(ConfigService)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(services.has(ConfigService)).toBe(false);
    });

    it('should work with symbol tokens', () => {
      services.addSingleton(ILogger, ConsoleLogger);
      expect(services.has(ILogger)).toBe(true);
    });
  });

  describe('getDescriptors', () => {
    it('should return all registered descriptors', () => {
      services
        .addSingleton(ConfigService)
        .addScoped(IDatabase, PostgresDatabase)
        .addTransient(ILogger, ConsoleLogger);

      const descriptors = services.getDescriptors();
      expect(descriptors).toHaveLength(3);
    });

    it('should return readonly array', () => {
      services.addSingleton(ConfigService);
      const descriptors = services.getDescriptors();

      // TypeScript should prevent modification, but verify at runtime
      expect(Array.isArray(descriptors)).toBe(true);
    });
  });

  describe('getDescriptor', () => {
    it('should return descriptor for registered service', () => {
      services.addSingleton(ILogger, ConsoleLogger);

      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor).toBeDefined();
      expect(descriptor!.serviceIdentifier).toBe(ILogger);
    });

    it('should return undefined for unregistered service', () => {
      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove registered service', () => {
      services.addSingleton(ConfigService);
      expect(services.has(ConfigService)).toBe(true);

      const result = services.remove(ConfigService);
      expect(result).toBe(true);
      expect(services.has(ConfigService)).toBe(false);
    });

    it('should return false for unregistered service', () => {
      const result = services.remove(ConfigService);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all registrations', () => {
      services.addSingleton(ConfigService).addScoped(IDatabase, PostgresDatabase);

      services.clear();

      expect(services.getDescriptors()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Build Tests
  // ============================================================================

  describe('build', () => {
    it('should return IServiceProvider', () => {
      services.addSingleton(ConfigService);
      const provider = services.build();

      expect(provider).toBeDefined();
      expect(typeof provider.resolve).toBe('function');
      expect(typeof provider.createScope).toBe('function');
    });

    it('should seal the collection after build', () => {
      services.addSingleton(ConfigService);
      services.build();

      expect(() => {
        services.addSingleton(ILogger, ConsoleLogger);
      }).toThrow(ContainerSealedError);
    });

    it('should prevent remove after build', () => {
      services.addSingleton(ConfigService);
      services.build();

      expect(() => {
        services.remove(ConfigService);
      }).toThrow(ContainerSealedError);
    });

    it('should prevent clear after build', () => {
      services.addSingleton(ConfigService);
      services.build();

      expect(() => {
        services.clear();
      }).toThrow(ContainerSealedError);
    });
  });

  // ============================================================================
  // Replacement Tests
  // ============================================================================

  describe('service replacement', () => {
    it('should replace existing registration', () => {
      class AnotherLogger implements ILoggerInterface {
        log(message: string): void {
          console.error(message);
        }
      }

      services.addSingleton(ILogger, ConsoleLogger);
      services.addSingleton(ILogger, AnotherLogger);

      const descriptor = services.getDescriptor(ILogger);
      expect(descriptor!.implementationType).toBe(AnotherLogger);
    });
  });
});

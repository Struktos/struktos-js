/**
 * @fileoverview ServiceIdentifier - Unified Service Identification
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module defines the type-safe service identification system that supports
 * constructor functions, symbols, and strings as service identifiers.
 *
 * ## Zero-Reflection Philosophy
 *
 * Struktos.js DI uses a Zero-Reflection approach:
 * - NO reflect-metadata dependency
 * - Dependencies declared via `static inject` property
 * - Factory functions for complex initialization
 *
 * ## Why Multiple Identifier Types?
 *
 * 1. **Constructor (Class)**: Direct class registration
 *    ```typescript
 *    container.register(UserService);
 *    ```
 *
 * 2. **Symbol**: Interface-based abstraction (recommended)
 *    ```typescript
 *    const ILogger = Symbol('ILogger');
 *    container.register(ILogger, ConsoleLogger);
 *    ```
 *
 * 3. **String**: Legacy support or external configuration
 *    ```typescript
 *    container.register('database.connection', PostgresConnection);
 *    ```
 *
 * @version 1.0.0
 */

/**
 * Symbol used to brand ServiceIdentifier types for type discrimination.
 * @internal
 */
export const SERVICE_IDENTIFIER_BRAND = Symbol('ServiceIdentifier');

/**
 * Type representing a constructor function.
 *
 * @template T - The instance type created by the constructor
 *
 * @remarks
 * This is the most common form of service identifier - a class constructor.
 * It provides excellent IDE support and type inference.
 *
 * @example
 * ```typescript
 * class UserService {
 *   static inject = [IUserRepository, ILogger];
 *   constructor(repo: IUserRepository, logger: ILogger) {}
 * }
 *
 * // Constructor is the identifier
 * container.register(UserService);
 * const service = container.resolve(UserService);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Abstract constructor type for interfaces/abstract classes.
 *
 * @template T - The instance type
 *
 * @remarks
 * Used when registering abstract classes or when you want to
 * allow both concrete and abstract constructors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;

/**
 * ServiceIdentifier - Unified type for identifying services in the DI container.
 *
 * @template T - The service instance type
 *
 * @remarks
 * **Three Forms of Identification:**
 *
 * 1. **Constructor<T>**: Class-based identification
 *    - Best for concrete implementations
 *    - Provides type inference
 *    - IDE autocomplete works perfectly
 *
 * 2. **Symbol**: Token-based identification
 *    - Best for interface abstractions
 *    - Prevents naming collisions
 *    - Enables interface-to-implementation binding
 *
 * 3. **string**: String-based identification
 *    - Legacy support
 *    - Configuration-driven DI
 *    - Not recommended for new code
 *
 * **Best Practice:**
 *
 * Use Symbols for interfaces, Constructors for concrete classes:
 *
 * ```typescript
 * // Define interface token
 * const IUserRepository = Symbol('IUserRepository');
 *
 * // Register implementation
 * container.addScoped(IUserRepository, PrismaUserRepository);
 *
 * // Resolve by token
 * const repo = container.resolve<IUserRepository>(IUserRepository);
 * ```
 *
 * @example Using constructor
 * ```typescript
 * class ConfigService {
 *   getConfig() { return { ... }; }
 * }
 *
 * container.addSingleton(ConfigService);
 * const config = container.resolve(ConfigService);
 * ```
 *
 * @example Using symbol
 * ```typescript
 * interface ILogger {
 *   log(message: string): void;
 * }
 *
 * const ILogger = Symbol('ILogger');
 *
 * class ConsoleLogger implements ILogger {
 *   log(message: string) { console.log(message); }
 * }
 *
 * container.addSingleton(ILogger, ConsoleLogger);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServiceIdentifier<T = any> = Constructor<T> | symbol | string;

/**
 * Check if a value is a valid ServiceIdentifier.
 *
 * @param value - Value to check
 * @returns True if value is a valid ServiceIdentifier
 *
 * @example
 * ```typescript
 * isServiceIdentifier(UserService); // true (constructor)
 * isServiceIdentifier(Symbol('ILogger')); // true (symbol)
 * isServiceIdentifier('my-service'); // true (string)
 * isServiceIdentifier(42); // false
 * isServiceIdentifier(null); // false
 * ```
 */
export function isServiceIdentifier(value: unknown): value is ServiceIdentifier {
  if (value === null || value === undefined) {
    return false;
  }

  const type = typeof value;

  // Symbol
  if (type === 'symbol') {
    return true;
  }

  // String
  if (type === 'string') {
    return true;
  }

  // Constructor function
  if (type === 'function') {
    return true;
  }

  return false;
}

/**
 * Get a human-readable name for a ServiceIdentifier.
 *
 * @param identifier - The service identifier
 * @returns Human-readable name string
 *
 * @remarks
 * Used for error messages and debugging.
 *
 * @example
 * ```typescript
 * getServiceName(UserService); // 'UserService'
 * getServiceName(Symbol('ILogger')); // 'Symbol(ILogger)'
 * getServiceName('my-service'); // 'my-service'
 * ```
 */
export function getServiceName(identifier: ServiceIdentifier): string {
  if (typeof identifier === 'symbol') {
    return identifier.toString();
  }

  if (typeof identifier === 'string') {
    return identifier;
  }

  if (typeof identifier === 'function') {
    return identifier.name || 'AnonymousClass';
  }

  return String(identifier);
}

/**
 * Create a unique key for storing service registrations.
 *
 * @param identifier - The service identifier
 * @returns Unique key string or symbol
 *
 * @remarks
 * Symbols are returned as-is (unique by nature).
 * Constructors use their name with a prefix.
 * Strings are returned with a prefix.
 *
 * @internal
 */
export function getServiceKey(identifier: ServiceIdentifier): string | symbol {
  if (typeof identifier === 'symbol') {
    return identifier;
  }

  if (typeof identifier === 'string') {
    return `str:${identifier}`;
  }

  if (typeof identifier === 'function') {
    // Use constructor name with prefix
    return `ctor:${identifier.name || 'Anonymous'}`;
  }

  throw new TypeError(`Invalid service identifier: ${String(identifier)}`);
}

// ============================================================================
// Injectable Interface (Static Inject Pattern)
// ============================================================================

/**
 * Interface for classes that declare their dependencies via static property.
 *
 * @template T - Instance type
 *
 * @remarks
 * **Zero-Reflection Dependency Declaration:**
 *
 * Instead of using decorators and reflect-metadata, Struktos.js uses
 * a static `inject` property to declare dependencies:
 *
 * ```typescript
 * class UserService implements IInjectable {
 *   static inject = [IUserRepository, ILogger] as const;
 *
 *   constructor(
 *     private repo: IUserRepository,
 *     private logger: ILogger
 *   ) {}
 * }
 * ```
 *
 * **Why Static Inject?**
 *
 * 1. **No Runtime Overhead**: No metadata reflection needed
 * 2. **Tree-Shakeable**: Bundlers can optimize unused code
 * 3. **Type-Safe**: TypeScript validates dependency array
 * 4. **Simple**: No decorators, no magic
 *
 * @example
 * ```typescript
 * const IDatabase = Symbol('IDatabase');
 * const ILogger = Symbol('ILogger');
 *
 * class OrderService implements IInjectable {
 *   // Declare dependencies
 *   static inject = [IDatabase, ILogger] as const;
 *
 *   constructor(
 *     private db: IDatabase,
 *     private logger: ILogger
 *   ) {}
 *
 *   async createOrder(data: CreateOrderData): Promise<Order> {
 *     this.logger.log('Creating order');
 *     return this.db.orders.create(data);
 *   }
 * }
 * ```
 */
export interface IInjectable {
  /**
   * Static property declaring dependencies.
   *
   * @remarks
   * Use `as const` for better type inference:
   * ```typescript
   * static inject = [ILogger, IDatabase] as const;
   * ```
   */
  // Note: This is a static property, not an instance property
  // TypeScript interfaces can't directly express static properties
}

/**
 * Type for a constructor with static inject property.
 *
 * @template T - Instance type
 *
 * @example
 * ```typescript
 * function createInstance<T>(ctor: IInjectableConstructor<T>): T {
 *   const deps = ctor.inject || [];
 *   const resolvedDeps = deps.map(dep => container.resolve(dep));
 *   return new ctor(...resolvedDeps);
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IInjectableConstructor<T = any> extends Constructor<T> {
  /**
   * Static array of dependency identifiers.
   * Order must match constructor parameter order.
   */
  inject?: readonly ServiceIdentifier[];
}

/**
 * Check if a constructor has static inject property.
 *
 * @param ctor - Constructor to check
 * @returns True if constructor has inject property
 */
export function hasInjectProperty(ctor: Constructor): ctor is IInjectableConstructor {
  return 'inject' in ctor && Array.isArray((ctor as IInjectableConstructor).inject);
}

/**
 * Get dependencies from a constructor's static inject property.
 *
 * @param ctor - Constructor to get dependencies from
 * @returns Array of dependency identifiers
 */
export function getInjectDependencies(ctor: Constructor): readonly ServiceIdentifier[] {
  if (hasInjectProperty(ctor)) {
    return ctor.inject ?? [];
  }
  return [];
}

// ============================================================================
// Token Creation Helpers
// ============================================================================

/**
 * Create a typed service token (Symbol) for interface abstraction.
 *
 * @template T - The interface type this token represents
 * @param description - Description for debugging
 * @returns A typed Symbol that can be used as ServiceIdentifier<T>
 *
 * @remarks
 * This is the recommended way to create tokens for interfaces:
 *
 * ```typescript
 * interface IUserRepository {
 *   findById(id: string): Promise<User | null>;
 *   save(user: User): Promise<void>;
 * }
 *
 * // Create typed token
 * const IUserRepository = createToken<IUserRepository>('IUserRepository');
 *
 * // Register implementation
 * container.addScoped(IUserRepository, PrismaUserRepository);
 *
 * // Resolve with correct type
 * const repo = container.resolve(IUserRepository);
 * // repo is typed as IUserRepository
 * ```
 *
 * @example
 * ```typescript
 * // Define interface and token
 * interface ILogger {
 *   info(message: string): void;
 *   error(message: string, error?: Error): void;
 * }
 *
 * const ILogger = createToken<ILogger>('ILogger');
 *
 * // Use in static inject
 * class UserService {
 *   static inject = [ILogger] as const;
 *   constructor(private logger: ILogger) {}
 * }
 * ```
 */
export function createToken<T>(description: string): ServiceIdentifier<T> {
  return Symbol(description) as ServiceIdentifier<T>;
}

// ============================================================================
// Pre-defined Core Tokens
// ============================================================================

/**
 * Token for the service provider itself.
 *
 * @remarks
 * Use this to inject the service provider into services:
 *
 * ```typescript
 * class ServiceFactory {
 *   static inject = [SERVICE_PROVIDER_TOKEN] as const;
 *   constructor(private provider: IServiceProvider) {}
 *
 *   createService<T>(id: ServiceIdentifier<T>): T {
 *     return this.provider.resolve(id);
 *   }
 * }
 * ```
 */
export const SERVICE_PROVIDER_TOKEN = Symbol('IServiceProvider');

/**
 * Token for the service scope.
 *
 * @remarks
 * Inject this to access the current scope:
 *
 * ```typescript
 * class ScopedService {
 *   static inject = [SERVICE_SCOPE_TOKEN] as const;
 *   constructor(private scope: IServiceScope) {}
 * }
 * ```
 */
export const SERVICE_SCOPE_TOKEN = Symbol('IServiceScope');

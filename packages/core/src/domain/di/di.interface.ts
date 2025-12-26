/**
 * @fileoverview DI Interfaces - Core Dependency Injection Contracts
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module defines the core interfaces for dependency injection.
 * These contracts are technology-agnostic and define WHAT the DI
 * system does, not HOW it does it.
 *
 * ## Zero-Reflection DI Pattern
 *
 * Struktos.js uses a Zero-Reflection approach:
 *
 * ```typescript
 * // Instead of decorators + reflect-metadata:
 * @Injectable()
 * class MyService {
 *   constructor(@Inject(ILogger) logger: ILogger) {}
 * }
 *
 * // We use static inject property:
 * class MyService {
 *   static inject = [ILogger] as const;
 *   constructor(logger: ILogger) {}
 * }
 * ```
 *
 * ## Integration with RequestContext
 *
 * Scoped services are tied to RequestContext for request isolation:
 *
 * ```
 * RequestContext.run() ──────────────────────────────────────┐
 * │                                                          │
 * │  Scope 1 ─────────────────────────────┐                 │
 * │  │ ScopedService A (instance-1)       │                 │
 * │  │ ScopedService B (instance-1)       │                 │
 * │  └────────────────────────────────────┘                 │
 * │                                                          │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * @version 1.0.0
 */

import { type IServiceDescriptor, type ServiceFactory } from './service-descriptor';
import { type ServiceIdentifier, type Constructor } from './service-identifier';

// ============================================================================
// IDisposable - Resource Cleanup Interface
// ============================================================================

/**
 * Interface for objects that need cleanup when disposed.
 *
 * @remarks
 * Services implementing this interface will have their `dispose()` method
 * called when the scope ends or the container is destroyed.
 *
 * **Automatic Disposal:**
 *
 * - Scoped services: Disposed when scope.dispose() is called
 * - Singleton services: Disposed when container is destroyed
 *
 * @example
 * ```typescript
 * class DatabaseContext implements IDisposable {
 *   private connection: Connection;
 *
 *   async dispose(): Promise<void> {
 *     await this.connection.close();
 *   }
 * }
 * ```
 */
export interface IDisposable {
  /**
   * Release resources held by this object.
   *
   * @remarks
   * - May be called multiple times (should be idempotent)
   * - Can be async for cleanup operations
   * - Errors should be caught and logged, not thrown
   */
  dispose(): void | Promise<void>;
}

/**
 * Check if an object implements IDisposable.
 */
export function isDisposable(obj: unknown): obj is IDisposable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'dispose' in obj &&
    typeof (obj as IDisposable).dispose === 'function'
  );
}

// ============================================================================
// IServiceCollection - Service Registration
// ============================================================================

/**
 * IServiceCollection - Fluent API for registering services.
 *
 * @remarks
 * **Configuration Phase:**
 *
 * IServiceCollection is used during application startup to configure
 * the DI container. This is the "registration" phase.
 *
 * ```typescript
 * const services = new ServiceCollection();
 *
 * services
 *   .addSingleton(IConfig, ConfigService)
 *   .addScoped(IUnitOfWork, PrismaUnitOfWork)
 *   .addTransient(CreateUserHandler);
 *
 * const provider = services.build();
 * ```
 *
 * **Registration Patterns:**
 *
 * 1. **Self-Registration** (implementation = service type)
 * ```typescript
 * services.addSingleton(ConfigService);
 * ```
 *
 * 2. **Interface-to-Implementation**
 * ```typescript
 * services.addScoped(IUserRepository, PrismaUserRepository);
 * ```
 *
 * 3. **Factory Registration**
 * ```typescript
 * services.addSingletonFactory(IConfig, () => loadConfig());
 * ```
 *
 * 4. **Instance Registration**
 * ```typescript
 * services.addSingletonInstance(IConfig, { port: 3000 });
 * ```
 *
 * @example Complete registration
 * ```typescript
 * const services = new ServiceCollection();
 *
 * // Singletons - Shared across app
 * services.addSingleton(ConfigService);
 * services.addSingleton(ILogger, ConsoleLogger);
 * services.addSingleton(IEventBus, InMemoryEventBus);
 *
 * // Scoped - Per request
 * services.addScoped(IUnitOfWork, PrismaUnitOfWork);
 * services.addScoped(IUserRepository, UserRepository);
 * services.addScoped(UserService);
 *
 * // Transient - Always new
 * services.addTransient(CreateUserHandler);
 * services.addTransient(GetUserHandler);
 *
 * // Build provider
 * const provider = services.build();
 * ```
 */
export interface IServiceCollection {
  // ============================================================================
  // Singleton Registration
  // ============================================================================

  /**
   * Register a singleton service (self-registration).
   *
   * @template T - Service type
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addSingleton<T>(implementation: Constructor<T>): this;

  /**
   * Register a singleton service (interface-to-implementation).
   *
   * @template T - Service type
   * @param identifier - Service identifier (token)
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addSingleton<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;

  /**
   * Register a singleton using a factory function.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @param factory - Factory function
   * @returns This collection for chaining
   */
  addSingletonFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this;

  /**
   * Register a pre-created instance as singleton.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @param instance - Pre-created instance
   * @returns This collection for chaining
   */
  addSingletonInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this;

  // ============================================================================
  // Scoped Registration
  // ============================================================================

  /**
   * Register a scoped service (self-registration).
   *
   * @template T - Service type
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addScoped<T>(implementation: Constructor<T>): this;

  /**
   * Register a scoped service (interface-to-implementation).
   *
   * @template T - Service type
   * @param identifier - Service identifier (token)
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addScoped<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;

  /**
   * Register a scoped service using a factory function.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @param factory - Factory function
   * @returns This collection for chaining
   */
  addScopedFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this;

  // ============================================================================
  // Transient Registration
  // ============================================================================

  /**
   * Register a transient service (self-registration).
   *
   * @template T - Service type
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addTransient<T>(implementation: Constructor<T>): this;

  /**
   * Register a transient service (interface-to-implementation).
   *
   * @template T - Service type
   * @param identifier - Service identifier (token)
   * @param implementation - Implementation class
   * @returns This collection for chaining
   */
  addTransient<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;

  /**
   * Register a transient service using a factory function.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @param factory - Factory function
   * @returns This collection for chaining
   */
  addTransientFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a service is registered.
   *
   * @param identifier - Service identifier
   * @returns True if registered
   */
  has(identifier: ServiceIdentifier): boolean;

  /**
   * Get all registered descriptors.
   *
   * @returns Array of service descriptors
   */
  getDescriptors(): readonly IServiceDescriptor[];

  /**
   * Build the service provider.
   *
   * @returns IServiceProvider instance
   *
   * @remarks
   * After calling build(), no more services can be registered.
   * The container is "sealed".
   */
  build(): IServiceProvider;
}

// ============================================================================
// IServiceProvider - Service Resolution
// ============================================================================

/**
 * IServiceProvider - Resolve services from the container.
 *
 * @remarks
 * **Resolution Phase:**
 *
 * IServiceProvider is used during runtime to resolve services.
 * It handles caching based on lifetime and scope.
 *
 * **Resolution Algorithm:**
 *
 * ```
 * resolve(identifier)
 *   1. Check if registered -> ServiceNotRegisteredError if not
 *   2. Check lifetime:
 *      - Singleton: Check global cache, create if missing
 *      - Scoped: Check scope cache, create if missing
 *      - Transient: Always create new
 *   3. Resolve dependencies (recursively)
 *   4. Create instance
 *   5. Cache based on lifetime
 *   6. Return instance
 * ```
 *
 * @example Basic resolution
 * ```typescript
 * const logger = provider.resolve(ILogger);
 * const userService = provider.resolve(UserService);
 * ```
 *
 * @example Scoped resolution
 * ```typescript
 * RequestContext.run({}, () => {
 *   const scope = provider.createScope();
 *   try {
 *     const uow = scope.resolve(IUnitOfWork);
 *     await uow.commit();
 *   } finally {
 *     scope.dispose();
 *   }
 * });
 * ```
 */
export interface IServiceProvider {
  /**
   * Resolve a service by its identifier.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Resolved service instance
   * @throws ServiceNotRegisteredError if not registered
   * @throws CircularDependencyError if circular dependency detected
   * @throws ScopeMismatchError if scope violation detected
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T;

  /**
   * Try to resolve a service, returning undefined if not registered.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Resolved service or undefined
   */
  tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined;

  /**
   * Resolve all services registered with the given identifier.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Array of resolved services
   *
   * @remarks
   * Useful for resolving multiple implementations:
   * ```typescript
   * const handlers = provider.resolveAll(ICommandHandler);
   * ```
   */
  resolveAll<T>(identifier: ServiceIdentifier<T>): T[];

  /**
   * Check if a service is registered.
   *
   * @param identifier - Service identifier
   * @returns True if registered
   */
  isRegistered(identifier: ServiceIdentifier): boolean;

  /**
   * Create a new scope for scoped services.
   *
   * @returns IServiceScope instance
   * @throws NoActiveScopeError if not inside RequestContext
   *
   * @remarks
   * Scopes must be created inside a RequestContext:
   *
   * ```typescript
   * RequestContext.run({}, () => {
   *   const scope = provider.createScope();
   *   // ... use scoped services
   *   scope.dispose();
   * });
   * ```
   */
  createScope(): IServiceScope;

  /**
   * Dispose the provider and all singleton services.
   */
  dispose(): Promise<void>;
}

// ============================================================================
// IServiceScope - Scoped Service Management
// ============================================================================

/**
 * IServiceScope - Manage a scope for scoped services.
 *
 * @remarks
 * **Scope Lifetime:**
 *
 * A scope represents a unit of work (typically one HTTP request):
 *
 * 1. Request arrives
 * 2. Create RequestContext
 * 3. Create Scope
 * 4. Resolve scoped services (cached within scope)
 * 5. Execute business logic
 * 6. Dispose scope (cleanup services)
 * 7. End RequestContext
 *
 * **Scope Isolation:**
 *
 * Each scope has its own cache of scoped instances:
 *
 * ```typescript
 * const scope1 = provider.createScope();
 * const scope2 = provider.createScope();
 *
 * const db1 = scope1.resolve(IDatabase);
 * const db2 = scope2.resolve(IDatabase);
 *
 * db1 !== db2  // Different scopes = different instances
 * ```
 *
 * @example Typical usage
 * ```typescript
 * RequestContext.run({}, async () => {
 *   const scope = provider.createScope();
 *   try {
 *     const uow = scope.resolve(IUnitOfWork);
 *     const userService = scope.resolve(UserService);
 *
 *     await userService.createUser(data);
 *     await uow.commit();
 *   } catch (error) {
 *     // Rollback handled by dispose
 *   } finally {
 *     scope.dispose(); // Cleanup all scoped services
 *   }
 * });
 * ```
 */
export interface IServiceScope extends IDisposable {
  /**
   * Resolve a service within this scope.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Resolved service instance
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T;

  /**
   * Try to resolve a service within this scope.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Resolved service or undefined
   */
  tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined;

  /**
   * Get the service provider for this scope.
   *
   * @returns Scoped service provider
   */
  getServiceProvider(): IServiceProvider;

  /**
   * Check if the scope has been disposed.
   */
  isDisposed(): boolean;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory for creating service scopes.
 *
 * @remarks
 * Can be injected to create scopes programmatically:
 *
 * ```typescript
 * class BackgroundJobRunner {
 *   static inject = [IServiceScopeFactory] as const;
 *
 *   constructor(private scopeFactory: IServiceScopeFactory) {}
 *
 *   async runJob(job: Job) {
 *     const scope = this.scopeFactory.createScope();
 *     try {
 *       const handler = scope.resolve(job.handlerType);
 *       await handler.execute(job.data);
 *     } finally {
 *       scope.dispose();
 *     }
 *   }
 * }
 * ```
 */
export interface IServiceScopeFactory {
  /**
   * Create a new service scope.
   *
   * @returns IServiceScope instance
   */
  createScope(): IServiceScope;
}

/**
 * Token for IServiceScopeFactory.
 */
export const SERVICE_SCOPE_FACTORY_TOKEN = Symbol('IServiceScopeFactory');

// ============================================================================
// Build Options
// ============================================================================

/**
 * Options for building the service provider.
 */
export interface IBuildOptions {
  /**
   * Validate scope dependencies at build time.
   *
   * @remarks
   * If true, will throw ScopeMismatchError during build if:
   * - Singleton depends on Scoped
   * - Singleton depends on Transient
   *
   * Default: true
   */
  validateScopes?: boolean;

  /**
   * Eagerly create all singleton instances at build time.
   *
   * @remarks
   * If true, all singleton services are instantiated during build.
   * This helps catch configuration errors early.
   *
   * Default: false
   */
  eagerSingletons?: boolean;

  /**
   * Allow resolving Scoped services without a scope.
   *
   * @remarks
   * If true, resolving a Scoped service without a scope
   * will create a Transient instance instead of throwing.
   *
   * Default: false (strict mode)
   */
  allowScopedWithoutScope?: boolean;
}

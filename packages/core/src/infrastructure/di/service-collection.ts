/**
 * @fileoverview ServiceCollection - Service Registration Implementation
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module implements IServiceCollection with a fluent API for
 * registering services in the DI container.
 *
 * @version 1.0.0
 */

import {
  type ServiceIdentifier,
  type Constructor,
  type IServiceDescriptor,
  type ServiceFactory,
  type IServiceCollection,
  type IServiceProvider,
  type IBuildOptions,
  ServiceLifetime,
  getServiceKey,
  createClassDescriptor,
  createFactoryDescriptor,
  createInstanceDescriptor,
  validateDescriptor,
  ContainerSealedError,
} from '../../domain/di';

import { ServiceProvider } from './service-provider';

/**
 * ServiceCollection - Fluent API for service registration.
 *
 * @remarks
 * **Usage Pattern:**
 *
 * ```typescript
 * const services = new ServiceCollection();
 *
 * services
 *   .addSingleton(ConfigService)
 *   .addScoped(IUserRepository, PrismaUserRepository)
 *   .addTransient(CreateUserHandler);
 *
 * const provider = services.build();
 * ```
 *
 * **Thread Safety:**
 *
 * ServiceCollection is NOT thread-safe. It should only be used
 * during application startup on a single thread.
 *
 * @example Complete application setup
 * ```typescript
 * const services = new ServiceCollection();
 *
 * // Infrastructure
 * services.addSingleton(ILogger, ConsoleLogger);
 * services.addSingleton(IEventBus, InMemoryEventBus);
 *
 * // Database
 * services.addScoped(IUnitOfWork, PrismaUnitOfWork);
 * services.addScoped(IUserRepository, UserRepository);
 *
 * // Application
 * services.addScoped(UserService);
 *
 * // Handlers
 * services.addTransient(CreateUserHandler);
 *
 * // Build and use
 * const provider = services.build();
 * ```
 */
export class ServiceCollection implements IServiceCollection {
  /**
   * Map of registered service descriptors.
   * Key: service key (from getServiceKey)
   * Value: IServiceDescriptor
   */
  private readonly descriptors = new Map<string | symbol, IServiceDescriptor>();

  /**
   * Whether the collection has been built (sealed).
   */
  private sealed = false;

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Ensure the collection hasn't been sealed.
   * @throws ContainerSealedError if sealed
   */
  private ensureNotSealed(): void {
    if (this.sealed) {
      throw new ContainerSealedError();
    }
  }

  /**
   * Register a service descriptor.
   */
  private register<T>(descriptor: IServiceDescriptor<T>): this {
    this.ensureNotSealed();
    validateDescriptor(descriptor);

    const key = getServiceKey(descriptor.serviceIdentifier);
    this.descriptors.set(key, descriptor);

    return this;
  }

  // ============================================================================
  // Singleton Registration
  // ============================================================================

  /**
   * Register a singleton service.
   *
   * @remarks
   * Two overloads:
   * 1. Self-registration: `addSingleton(ConfigService)`
   * 2. Interface-to-impl: `addSingleton(IConfig, ConfigService)`
   */
  addSingleton<T>(implementation: Constructor<T>): this;
  addSingleton<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;
  addSingleton<T>(
    identifierOrImpl: ServiceIdentifier<T> | Constructor<T>,
    implementation?: Constructor<T>,
  ): this {
    const [identifier, impl] = this.normalizeArgs(identifierOrImpl, implementation);

    return this.register(createClassDescriptor(identifier, ServiceLifetime.Singleton, impl));
  }

  /**
   * Register a singleton using a factory function.
   */
  addSingletonFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this {
    return this.register(createFactoryDescriptor(identifier, ServiceLifetime.Singleton, factory));
  }

  /**
   * Register a pre-created instance as singleton.
   */
  addSingletonInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this {
    return this.register(createInstanceDescriptor(identifier, instance));
  }

  // ============================================================================
  // Scoped Registration
  // ============================================================================

  /**
   * Register a scoped service.
   */
  addScoped<T>(implementation: Constructor<T>): this;
  addScoped<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;
  addScoped<T>(
    identifierOrImpl: ServiceIdentifier<T> | Constructor<T>,
    implementation?: Constructor<T>,
  ): this {
    const [identifier, impl] = this.normalizeArgs(identifierOrImpl, implementation);

    return this.register(createClassDescriptor(identifier, ServiceLifetime.Scoped, impl));
  }

  /**
   * Register a scoped service using a factory function.
   */
  addScopedFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this {
    return this.register(createFactoryDescriptor(identifier, ServiceLifetime.Scoped, factory));
  }

  // ============================================================================
  // Transient Registration
  // ============================================================================

  /**
   * Register a transient service.
   */
  addTransient<T>(implementation: Constructor<T>): this;
  addTransient<T>(identifier: ServiceIdentifier<T>, implementation: Constructor<T>): this;
  addTransient<T>(
    identifierOrImpl: ServiceIdentifier<T> | Constructor<T>,
    implementation?: Constructor<T>,
  ): this {
    const [identifier, impl] = this.normalizeArgs(identifierOrImpl, implementation);

    return this.register(createClassDescriptor(identifier, ServiceLifetime.Transient, impl));
  }

  /**
   * Register a transient service using a factory function.
   */
  addTransientFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): this {
    return this.register(createFactoryDescriptor(identifier, ServiceLifetime.Transient, factory));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a service is registered.
   */
  has(identifier: ServiceIdentifier): boolean {
    const key = getServiceKey(identifier);
    return this.descriptors.has(key);
  }

  /**
   * Get all registered descriptors.
   */
  getDescriptors(): readonly IServiceDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /**
   * Get a specific descriptor.
   */
  getDescriptor<T>(identifier: ServiceIdentifier<T>): IServiceDescriptor<T> | undefined {
    const key = getServiceKey(identifier);
    return this.descriptors.get(key) as IServiceDescriptor<T> | undefined;
  }

  /**
   * Remove a service registration.
   */
  remove(identifier: ServiceIdentifier): boolean {
    this.ensureNotSealed();
    const key = getServiceKey(identifier);
    return this.descriptors.delete(key);
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.ensureNotSealed();
    this.descriptors.clear();
  }

  /**
   * Build the service provider.
   */
  build(options?: IBuildOptions): IServiceProvider {
    this.sealed = true;

    const descriptorMap = new Map(this.descriptors);

    return new ServiceProvider(descriptorMap, options);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Normalize registration arguments.
   *
   * Handles two overload patterns:
   * 1. `add*(Implementation)` - self-registration
   * 2. `add*(Identifier, Implementation)` - interface-to-impl
   */
  private normalizeArgs<T>(
    identifierOrImpl: ServiceIdentifier<T> | Constructor<T>,
    implementation?: Constructor<T>,
  ): [ServiceIdentifier<T>, Constructor<T>] {
    if (implementation !== undefined) {
      // Pattern: add*(Identifier, Implementation)
      return [identifierOrImpl as ServiceIdentifier<T>, implementation];
    }

    // Pattern: add*(Implementation) - self-registration
    if (typeof identifierOrImpl === 'function') {
      const impl = identifierOrImpl as Constructor<T>;
      return [impl, impl];
    }

    throw new TypeError(
      `Invalid registration: expected a constructor or [identifier, implementation], ` +
        `got ${typeof identifierOrImpl}`,
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new ServiceCollection.
 *
 * @returns New ServiceCollection instance
 *
 * @example
 * ```typescript
 * const services = createServiceCollection();
 * services.addSingleton(ConfigService);
 * const provider = services.build();
 * ```
 */
export function createServiceCollection(): IServiceCollection {
  return new ServiceCollection();
}

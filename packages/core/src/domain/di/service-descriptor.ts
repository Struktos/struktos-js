/**
 * @fileoverview IServiceDescriptor - Service Registration Metadata
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module defines the metadata structure for registered services.
 * IServiceDescriptor holds all information needed to resolve a service.
 *
 * @version 1.0.0
 */

import { type ServiceIdentifier, type Constructor } from './service-identifier';
import { ServiceLifetime } from './service-lifetime';

/**
 * Factory function type for creating service instances.
 *
 * @template T - The service instance type
 *
 * @remarks
 * Factory functions provide full control over instance creation.
 * They receive a resolver for accessing other services.
 *
 * @example Simple factory
 * ```typescript
 * const configFactory: ServiceFactory<IConfig> = (resolver) => {
 *   return {
 *     databaseUrl: process.env.DATABASE_URL,
 *     port: parseInt(process.env.PORT || '3000'),
 *   };
 * };
 * ```
 *
 * @example Factory with dependencies
 * ```typescript
 * const loggerFactory: ServiceFactory<ILogger> = (resolver) => {
 *   const config = resolver.resolve<IConfig>(IConfig);
 *   return new WinstonLogger(config.logLevel);
 * };
 * ```
 *
 * @example Async factory
 * ```typescript
 * const dbFactory: ServiceFactory<IDatabase> = async (resolver) => {
 *   const config = resolver.resolve<IConfig>(IConfig);
 *   const db = new PostgresDatabase(config.databaseUrl);
 *   await db.connect();
 *   return db;
 * };
 * ```
 */
export type ServiceFactory<T> = (resolver: IServiceResolver) => T | Promise<T>;

/**
 * Minimal resolver interface used by factories.
 *
 * @remarks
 * This is a subset of IServiceProvider to avoid circular dependencies.
 */
export interface IServiceResolver {
  /**
   * Resolve a service by its identifier.
   *
   * @template T - Service type
   * @param identifier - Service identifier
   * @returns Resolved service instance
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
}

/**
 * IServiceDescriptor - Complete metadata for a registered service.
 *
 * @template T - The service instance type
 *
 * @remarks
 * **Internal Representation:**
 *
 * IServiceDescriptor is the internal data structure used by the DI container
 * to store service registration information.
 *
 * **Two Registration Patterns:**
 *
 * 1. **Class-based**: Uses `implementationType`
 * ```typescript
 * {
 *   serviceIdentifier: IUserRepository,
 *   lifetime: ServiceLifetime.Scoped,
 *   implementationType: PrismaUserRepository,
 * }
 * ```
 *
 * 2. **Factory-based**: Uses `factory`
 * ```typescript
 * {
 *   serviceIdentifier: IConfig,
 *   lifetime: ServiceLifetime.Singleton,
 *   factory: (resolver) => loadConfig(),
 * }
 * ```
 *
 * **Invariants:**
 *
 * - Either `implementationType` OR `factory` must be provided (not both, not neither)
 * - `implementationType` must have a constructor
 * - Factory must return the correct type
 */
export interface IServiceDescriptor<T = unknown> {
  /**
   * The identifier used to request this service.
   *
   * @remarks
   * This is the "key" used when calling `resolve()`.
   * Can be a constructor, symbol, or string.
   */
  readonly serviceIdentifier: ServiceIdentifier<T>;

  /**
   * The lifecycle scope of this service.
   *
   * @remarks
   * Determines caching behavior:
   * - Singleton: Cached globally
   * - Scoped: Cached per scope
   * - Transient: Never cached
   */
  readonly lifetime: ServiceLifetime;

  /**
   * The concrete implementation class.
   *
   * @remarks
   * Mutually exclusive with `factory`.
   * The container will instantiate this class, resolving its dependencies.
   */
  readonly implementationType?: Constructor<T>;

  /**
   * Factory function for creating instances.
   *
   * @remarks
   * Mutually exclusive with `implementationType`.
   * Provides full control over instance creation.
   */
  readonly factory?: ServiceFactory<T>;

  /**
   * Optional human-readable name for debugging.
   *
   * @remarks
   * Auto-generated from identifier if not provided.
   */
  readonly name?: string | undefined;

  /**
   * Optional tags for filtering and discovery.
   *
   * @remarks
   * Can be used to find groups of services:
   * ```typescript
   * const handlers = container.resolveByTag('command-handler');
   * ```
   */
  readonly tags?: readonly string[] | undefined;

  /**
   * Custom metadata for application-specific purposes.
   */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Options for creating a IServiceDescriptor.
 *
 * @template T - Service type
 */
export interface IIServiceDescriptorOptions<_T = unknown> {
  /**
   * Tags for service discovery.
   */
  tags?: string[];

  /**
   * Custom metadata.
   */
  metadata?: Record<string, unknown>;

  /**
   * Human-readable name.
   */
  name?: string;
}

/**
 * Create a IServiceDescriptor for a class-based registration.
 *
 * @template T - Service type
 * @param serviceIdentifier - The service identifier
 * @param lifetime - Service lifetime
 * @param implementationType - Implementation class
 * @param options - Optional configuration
 * @returns IServiceDescriptor instance
 *
 * @example
 * ```typescript
 * const descriptor = createClassDescriptor(
 *   IUserRepository,
 *   ServiceLifetime.Scoped,
 *   PrismaUserRepository,
 *   { tags: ['repository'] }
 * );
 * ```
 */
export function createClassDescriptor<T>(
  serviceIdentifier: ServiceIdentifier<T>,
  lifetime: ServiceLifetime,
  implementationType: Constructor<T>,
  options?: IIServiceDescriptorOptions<T>,
): IServiceDescriptor<T> {
  return {
    serviceIdentifier,
    lifetime,
    implementationType,
    name: options?.name,
    tags: options?.tags,
    metadata: options?.metadata,
  };
}

/**
 * Create a IServiceDescriptor for a factory-based registration.
 *
 * @template T - Service type
 * @param serviceIdentifier - The service identifier
 * @param lifetime - Service lifetime
 * @param factory - Factory function
 * @param options - Optional configuration
 * @returns IServiceDescriptor instance
 *
 * @example
 * ```typescript
 * const descriptor = createFactoryDescriptor(
 *   IConfig,
 *   ServiceLifetime.Singleton,
 *   () => loadConfigFromEnv(),
 * );
 * ```
 */
export function createFactoryDescriptor<T>(
  serviceIdentifier: ServiceIdentifier<T>,
  lifetime: ServiceLifetime,
  factory: ServiceFactory<T>,
  options?: IIServiceDescriptorOptions<T>,
): IServiceDescriptor<T> {
  return {
    serviceIdentifier,
    lifetime,
    factory,
    name: options?.name,
    tags: options?.tags,
    metadata: options?.metadata,
  };
}

/**
 * Create a IServiceDescriptor for a pre-created instance.
 *
 * @template T - Service type
 * @param serviceIdentifier - The service identifier
 * @param instance - Pre-created instance
 * @param options - Optional configuration
 * @returns IServiceDescriptor instance
 *
 * @remarks
 * Instance registrations are always Singleton (the instance already exists).
 *
 * @example
 * ```typescript
 * const config = { port: 3000, dbUrl: '...' };
 * const descriptor = createInstanceDescriptor(IConfig, config);
 * ```
 */
export function createInstanceDescriptor<T>(
  serviceIdentifier: ServiceIdentifier<T>,
  instance: T,
  options?: IIServiceDescriptorOptions<T>,
): IServiceDescriptor<T> {
  return {
    serviceIdentifier,
    lifetime: ServiceLifetime.Singleton,
    factory: () => instance,
    name: options?.name,
    tags: options?.tags,
    metadata: options?.metadata,
  };
}

/**
 * Validate a IServiceDescriptor.
 *
 * @param descriptor - Descriptor to validate
 * @throws Error if descriptor is invalid
 *
 * @internal
 */
export function validateDescriptor<T>(descriptor: IServiceDescriptor<T>): void {
  // Must have either implementationType OR factory
  const hasImplementation = descriptor.implementationType !== undefined;
  const hasFactory = descriptor.factory !== undefined;

  if (!hasImplementation && !hasFactory) {
    throw new Error(
      `IServiceDescriptor for '${String(descriptor.serviceIdentifier)}' ` +
        'must have either implementationType or factory',
    );
  }

  if (hasImplementation && hasFactory) {
    throw new Error(
      `IServiceDescriptor for '${String(descriptor.serviceIdentifier)}' ` +
        'cannot have both implementationType and factory',
    );
  }

  // Validate implementationType is a constructor
  if (hasImplementation && typeof descriptor.implementationType !== 'function') {
    throw new Error(
      `implementationType for '${String(descriptor.serviceIdentifier)}' ` +
        'must be a constructor function',
    );
  }

  // Validate factory is a function
  if (hasFactory && typeof descriptor.factory !== 'function') {
    throw new Error(
      `factory for '${String(descriptor.serviceIdentifier)}' ` + 'must be a function',
    );
  }
}

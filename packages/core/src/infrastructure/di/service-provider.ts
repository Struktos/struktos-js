/**
 * @fileoverview ServiceProvider - Core Dependency Resolution Engine
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module implements the core dependency resolution algorithm.
 * It handles singleton caching, scope management, and circular dependency detection.
 *
 * ## Resolution Algorithm
 *
 * ```
 * resolve(identifier)
 *   1. Find descriptor
 *   2. Check for circular dependency
 *   3. Based on lifetime:
 *      - Singleton: Check global cache, create if missing
 *      - Scoped: Delegate to scope
 *      - Transient: Always create new
 *   4. If creating:
 *      a. Get dependencies from static inject
 *      b. Recursively resolve dependencies
 *      c. Create instance (constructor or factory)
 *      d. Cache based on lifetime
 *   5. Return instance
 * ```
 *
 * ## Zero-Reflection Pattern
 *
 * Dependencies are read from `static inject` property:
 *
 * ```typescript
 * class UserService {
 *   static inject = [IUserRepository, ILogger] as const;
 *   constructor(repo: IUserRepository, logger: ILogger) {}
 * }
 * ```
 *
 * @version 1.0.0
 */

import {
  type ServiceIdentifier,
  type Constructor,
  type IServiceDescriptor,
  type IServiceProvider,
  type IServiceScope,
  type IServiceResolver,
  type IBuildOptions,
  ServiceLifetime,
  getServiceKey,
  getServiceName,
  getInjectDependencies,
  canDependOn,
  isDisposable,
  ServiceNotRegisteredError,
  CircularDependencyError,
  ScopeMismatchError,
  NoActiveScopeError,
  ServiceCreationError,
  SERVICE_PROVIDER_TOKEN,
  SERVICE_SCOPE_FACTORY_TOKEN,
} from '../../domain/di';
import { RequestContext } from '../context';

import { ScopedContainer } from './scoped-container';

/**
 * Context key for storing the current scope in RequestContext.
 * @internal
 */
export const SCOPE_CONTEXT_KEY = 'struktos:di:scope';

/**
 * ServiceProvider - IServiceProvider implementation.
 *
 * @remarks
 * **Lifecycle Management:**
 *
 * - Singleton: Cached in `singletonCache`
 * - Scoped: Cached in current scope (via RequestContext)
 * - Transient: Never cached
 *
 * **Circular Dependency Detection:**
 *
 * Uses a resolution stack to track the current resolution path.
 * If the same identifier appears twice in the stack, it's circular.
 *
 * **Thread Safety (Async Safety):**
 *
 * Singleton cache is shared but singletons are immutable after creation.
 * Scoped caches are isolated per RequestContext (via AsyncLocalStorage).
 *
 * @example
 * ```typescript
 * const provider = new ServiceProvider(descriptors);
 *
 * // Resolve singleton
 * const logger = provider.resolve(ILogger);
 *
 * // Resolve scoped (requires scope)
 * RequestContext.run({}, () => {
 *   const scope = provider.createScope();
 *   const uow = scope.resolve(IUnitOfWork);
 *   scope.dispose();
 * });
 * ```
 */
export class ServiceProvider implements IServiceProvider, IServiceResolver {
  /**
   * Map of service descriptors.
   */
  private readonly descriptors: Map<string | symbol, IServiceDescriptor>;

  /**
   * Cache for singleton instances.
   */
  private readonly singletonCache = new Map<string | symbol, unknown>();

  /**
   * Build options.
   */
  private readonly options: Required<IBuildOptions>;

  /**
   * Whether the provider has been disposed.
   */
  private disposed = false;

  constructor(descriptors: Map<string | symbol, IServiceDescriptor>, options?: IBuildOptions) {
    this.descriptors = descriptors;
    this.options = {
      validateScopes: options?.validateScopes ?? true,
      eagerSingletons: options?.eagerSingletons ?? false,
      allowScopedWithoutScope: options?.allowScopedWithoutScope ?? false,
    };

    // Register self as service provider
    this.singletonCache.set(getServiceKey(SERVICE_PROVIDER_TOKEN), this);

    // Register scope factory
    this.singletonCache.set(getServiceKey(SERVICE_SCOPE_FACTORY_TOKEN), {
      createScope: () => this.createScope(),
    });

    // Validate scopes at build time
    if (this.options.validateScopes) {
      this.validateScopeDependencies();
    }

    // Eager singleton creation
    if (this.options.eagerSingletons) {
      this.createEagerSingletons();
    }
  }

  // ============================================================================
  // IServiceProvider Implementation
  // ============================================================================

  /**
   * Resolve a service by its identifier.
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    this.ensureNotDisposed();

    const resolutionStack: string[] = [];
    return this.resolveInternal(identifier, resolutionStack);
  }

  /**
   * Try to resolve a service, returning undefined if not registered.
   */
  tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined {
    try {
      return this.resolve(identifier);
    } catch (error) {
      if (error instanceof ServiceNotRegisteredError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Resolve all services with the given identifier.
   *
   * @remarks
   * Currently returns a single-element array if registered.
   * Future: Support multiple registrations per identifier.
   */
  resolveAll<T>(identifier: ServiceIdentifier<T>): T[] {
    const service = this.tryResolve(identifier);
    return service !== undefined ? [service] : [];
  }

  /**
   * Check if a service is registered.
   */
  isRegistered(identifier: ServiceIdentifier): boolean {
    const key = getServiceKey(identifier);
    return this.descriptors.has(key);
  }

  /**
   * Create a new scope for scoped services.
   */
  createScope(): IServiceScope {
    // Check for active RequestContext
    if (!RequestContext.hasContext()) {
      throw new NoActiveScopeError(Symbol('(scope creation)') as ServiceIdentifier, []);
    }

    const ctx = RequestContext.require();

    // Check if there's already a scope in context
    const existingScope = ctx.get(SCOPE_CONTEXT_KEY) as ScopedContainer | undefined;
    if (existingScope && !existingScope.isDisposed()) {
      // Return existing scope for this context
      // This enables nested resolution to share the same scope
      return existingScope;
    }

    // Create new scope and register in context
    const scope = new ScopedContainer(this, this.descriptors);
    ctx.set(SCOPE_CONTEXT_KEY, scope);

    // Register cleanup on context cancellation
    ctx.onCancel(async () => {
      await scope.dispose();
    });

    return scope;
  }

  /**
   * Dispose the provider and all singletons.
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose all singleton instances that implement IDisposable
    for (const instance of this.singletonCache.values()) {
      if (isDisposable(instance)) {
        try {
          await instance.dispose();
        } catch (error) {
          console.error('Error disposing singleton:', error);
        }
      }
    }

    this.singletonCache.clear();
  }

  // ============================================================================
  // Internal Resolution
  // ============================================================================

  /**
   * Internal resolution with circular dependency tracking.
   */
  private resolveInternal<T>(identifier: ServiceIdentifier<T>, resolutionStack: string[]): T {
    const key = getServiceKey(identifier);
    const name = getServiceName(identifier);

    // Check for circular dependency
    if (resolutionStack.includes(name)) {
      throw new CircularDependencyError(identifier, resolutionStack);
    }

    // Find descriptor
    const descriptor = this.descriptors.get(key) as IServiceDescriptor<T> | undefined;
    if (!descriptor) {
      throw new ServiceNotRegisteredError(identifier, resolutionStack);
    }

    // Handle based on lifetime
    switch (descriptor.lifetime) {
      case ServiceLifetime.Singleton:
        return this.resolveSingleton(descriptor, resolutionStack);

      case ServiceLifetime.Scoped:
        return this.resolveScoped(descriptor, resolutionStack);

      case ServiceLifetime.Transient:
        return this.createInstance(descriptor, resolutionStack);

      default:
        throw new Error(`Unknown lifetime: ${descriptor.lifetime}`);
    }
  }

  /**
   * Resolve a singleton service.
   */
  private resolveSingleton<T>(descriptor: IServiceDescriptor<T>, resolutionStack: string[]): T {
    const key = getServiceKey(descriptor.serviceIdentifier);

    // Check cache
    if (this.singletonCache.has(key)) {
      return this.singletonCache.get(key) as T;
    }

    // Create and cache
    const instance = this.createInstance(descriptor, resolutionStack);
    this.singletonCache.set(key, instance);

    return instance;
  }

  /**
   * Resolve a scoped service.
   */
  private resolveScoped<T>(descriptor: IServiceDescriptor<T>, resolutionStack: string[]): T {
    // Get current scope from RequestContext
    const ctx = RequestContext.current();
    if (!ctx) {
      if (this.options.allowScopedWithoutScope) {
        // Fallback: Create as transient
        return this.createInstance(descriptor, resolutionStack);
      }
      throw new NoActiveScopeError(descriptor.serviceIdentifier, resolutionStack);
    }

    // Get or create scope
    let scope = ctx.get(SCOPE_CONTEXT_KEY) as ScopedContainer | undefined;
    if (!scope) {
      // Auto-create scope for this context
      scope = new ScopedContainer(this, this.descriptors);
      ctx.set(SCOPE_CONTEXT_KEY, scope);

      // Register cleanup on context cancellation
      ctx.onCancel(async () => {
        await scope?.dispose();
      });
    }

    // Delegate to scope
    return scope.resolveScoped(descriptor, resolutionStack);
  }

  /**
   * Create a new instance of a service.
   */
  createInstance<T>(descriptor: IServiceDescriptor<T>, resolutionStack: string[]): T {
    const name = getServiceName(descriptor.serviceIdentifier);
    const newStack = [...resolutionStack, name];

    try {
      if (descriptor.factory) {
        // Factory-based creation
        const result = descriptor.factory(this.createResolver(newStack));

        // Handle async factories
        if (result instanceof Promise) {
          throw new Error(
            `Async factories are not supported in synchronous resolution. ` +
              `Use resolveAsync() for service '${name}'.`,
          );
        }

        return result;
      }

      if (descriptor.implementationType) {
        // Class-based creation with static inject
        return this.createFromConstructor(descriptor.implementationType, descriptor, newStack);
      }

      throw new Error(`No factory or implementation type for '${name}'`);
    } catch (error) {
      if (
        error instanceof ServiceNotRegisteredError ||
        error instanceof CircularDependencyError ||
        error instanceof ScopeMismatchError ||
        error instanceof NoActiveScopeError
      ) {
        throw error;
      }

      throw new ServiceCreationError(
        descriptor.serviceIdentifier,
        error instanceof Error ? error : new Error(String(error)),
        resolutionStack,
      );
    }
  }

  /**
   * Create instance from constructor with dependency injection.
   */
  private createFromConstructor<T>(
    ctor: Constructor<T>,
    descriptor: IServiceDescriptor<T>,
    resolutionStack: string[],
  ): T {
    // Get dependencies from static inject
    const dependencies = getInjectDependencies(ctor);

    // Validate scope dependencies
    if (this.options.validateScopes) {
      this.validateDependencyScopes(descriptor, dependencies, resolutionStack);
    }

    // Resolve each dependency
    const resolvedDeps = dependencies.map((dep) => this.resolveInternal(dep, resolutionStack));

    // Create instance
    return new ctor(...resolvedDeps);
  }

  /**
   * Create a resolver for factory functions.
   */
  private createResolver(resolutionStack: string[]): IServiceResolver {
    return {
      resolve: <T>(identifier: ServiceIdentifier<T>): T => {
        return this.resolveInternal(identifier, resolutionStack);
      },
      tryResolve: <T>(identifier: ServiceIdentifier<T>): T | undefined => {
        try {
          return this.resolveInternal(identifier, resolutionStack);
        } catch {
          return undefined;
        }
      },
    };
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate scope dependencies at build time.
   */
  private validateScopeDependencies(): void {
    for (const [_key, descriptor] of this.descriptors) {
      if (descriptor.implementationType) {
        const deps = getInjectDependencies(descriptor.implementationType);
        this.validateDependencyScopes(descriptor, deps, []);
      }
    }
  }

  /**
   * Validate that a service's dependencies have compatible scopes.
   */
  private validateDependencyScopes(
    descriptor: IServiceDescriptor,
    dependencies: readonly ServiceIdentifier[],
    resolutionStack: string[],
  ): void {
    for (const dep of dependencies) {
      const depKey = getServiceKey(dep);
      const depDescriptor = this.descriptors.get(depKey);

      if (!depDescriptor) {
        // Will be caught during resolution
        continue;
      }

      if (!canDependOn(descriptor.lifetime, depDescriptor.lifetime)) {
        throw new ScopeMismatchError(
          descriptor.serviceIdentifier,
          dep,
          descriptor.lifetime,
          depDescriptor.lifetime,
          resolutionStack,
        );
      }
    }
  }

  /**
   * Eagerly create all singleton instances.
   */
  private createEagerSingletons(): void {
    for (const [_key, descriptor] of this.descriptors) {
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        this.resolveSingleton(descriptor, []);
      }
    }
  }

  /**
   * Ensure provider hasn't been disposed.
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ServiceProvider has been disposed');
    }
  }

  // ============================================================================
  // For ScopedContainer Access
  // ============================================================================

  /**
   * Get the descriptors map (for ScopedContainer).
   * @internal
   */
  getDescriptors(): Map<string | symbol, IServiceDescriptor> {
    return this.descriptors;
  }

  /**
   * Get the options (for ScopedContainer).
   * @internal
   */
  getOptions(): Required<IBuildOptions> {
    return this.options;
  }
}

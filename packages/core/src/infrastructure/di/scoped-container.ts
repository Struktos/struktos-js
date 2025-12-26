/**
 * @fileoverview ScopedContainer - Request-Scoped Service Management
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module implements scoped service management, integrating the DI
 * container with RequestContext for request-isolated instances.
 *
 * ## Integration with RequestContext
 *
 * ScopedContainer is tied to a RequestContext scope:
 *
 * ```
 * RequestContext.run() ─────────────────────────────────────┐
 * │                                                          │
 * │  ScopedContainer ────────────────────┐                  │
 * │  │                                   │                  │
 * │  │  scopedCache:                     │                  │
 * │  │    IUnitOfWork -> instance-1      │                  │
 * │  │    UserService -> instance-1      │                  │
 * │  │                                   │                  │
 * │  └───────────────────────────────────┘                  │
 * │                                                          │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * **Lifecycle:**
 *
 * 1. RequestContext.run() starts
 * 2. provider.createScope() creates ScopedContainer
 * 3. Scoped services resolved within container are cached
 * 4. scope.dispose() cleans up all cached instances
 * 5. RequestContext ends
 *
 * @version 1.0.0
 */

import {
  type ServiceIdentifier,
  type IServiceDescriptor,
  type IServiceProvider,
  type IServiceScope,
  ServiceLifetime,
  getServiceKey,
  isDisposable,
  ScopeDisposedError,
  ServiceNotRegisteredError,
} from '../../domain/di';

import type { ServiceProvider } from './service-provider';

/**
 * ScopedContainer - IServiceScope implementation.
 *
 * @remarks
 * **Responsibilities:**
 *
 * 1. Cache scoped service instances for this scope
 * 2. Delegate singleton resolution to root provider
 * 3. Create transient instances
 * 4. Dispose all cached instances when scope ends
 *
 * **Usage:**
 *
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
 *
 * **Automatic Cleanup:**
 *
 * When dispose() is called:
 * 1. All cached instances implementing IDisposable are disposed
 * 2. Cache is cleared
 * 3. Scope is marked as disposed
 *
 * @example With Unit of Work
 * ```typescript
 * const scope = provider.createScope();
 * try {
 *   const uow = scope.resolve(IUnitOfWork);
 *   const userService = scope.resolve(UserService);
 *
 *   await userService.createUser(data);
 *   await uow.commit();
 * } catch (error) {
 *   // Rollback via dispose
 *   throw error;
 * } finally {
 *   scope.dispose(); // Calls uow.dispose() automatically
 * }
 * ```
 */
export class ScopedContainer implements IServiceScope {
  /**
   * Reference to the root service provider.
   */
  private readonly rootProvider: ServiceProvider;

  /**
   * Service descriptors map.
   */
  private readonly descriptors: Map<string | symbol, IServiceDescriptor>;

  /**
   * Cache for scoped service instances.
   */
  private readonly scopedCache = new Map<string | symbol, unknown>();

  /**
   * Whether this scope has been disposed.
   */
  private disposed = false;

  /**
   * List of disposable instances (in creation order).
   * Used for proper disposal order (LIFO).
   */
  private readonly disposables: { instance: unknown; key: string | symbol }[] = [];

  constructor(
    rootProvider: ServiceProvider,
    descriptors: Map<string | symbol, IServiceDescriptor>,
  ) {
    this.rootProvider = rootProvider;
    this.descriptors = descriptors;
  }

  // ============================================================================
  // IServiceScope Implementation
  // ============================================================================

  /**
   * Resolve a service within this scope.
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    this.ensureNotDisposed();

    const resolutionStack: string[] = [];
    return this.resolveInternal(identifier, resolutionStack);
  }

  /**
   * Try to resolve a service within this scope.
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
   * Get the service provider for this scope.
   *
   * @remarks
   * Returns a proxy that uses this scope for resolution.
   */
  getServiceProvider(): IServiceProvider {
    return {
      resolve: <T>(id: ServiceIdentifier<T>) => this.resolve(id),
      tryResolve: <T>(id: ServiceIdentifier<T>) => this.tryResolve(id),
      resolveAll: <T>(id: ServiceIdentifier<T>) => {
        const service = this.tryResolve(id);
        return service !== undefined ? [service] : [];
      },
      isRegistered: (id: ServiceIdentifier) => this.rootProvider.isRegistered(id),
      createScope: () => this.rootProvider.createScope(),
      dispose: async () => await this.dispose(),
    };
  }

  /**
   * Check if the scope has been disposed.
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the scope and all scoped services.
   */
  dispose(): void | Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose in reverse order (LIFO) for proper cleanup
    const errors: Error[] = [];

    for (let i = this.disposables.length - 1; i >= 0; i--) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { instance } = this.disposables[i] as any;
      if (isDisposable(instance)) {
        try {
          const result = instance.dispose();
          // Handle async dispose
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error('Error disposing scoped service:', error);
            });
          }
        } catch (error) {
          console.error('Error disposing scoped service:', error);
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    // Clear caches
    this.scopedCache.clear();
    this.disposables.length = 0;

    // If there were errors, log them but don't throw
    // (Disposal should be best-effort)
    if (errors.length > 0) {
      console.error(`${errors.length} error(s) during scope disposal`);
    }
  }

  // ============================================================================
  // Internal Resolution
  // ============================================================================

  /**
   * Internal resolution logic.
   */
  private resolveInternal<T>(identifier: ServiceIdentifier<T>, resolutionStack: string[]): T {
    const key = getServiceKey(identifier);
    const descriptor = this.descriptors.get(key) as IServiceDescriptor<T> | undefined;

    if (!descriptor) {
      throw new ServiceNotRegisteredError(identifier, resolutionStack);
    }

    switch (descriptor.lifetime) {
      case ServiceLifetime.Singleton:
        // Delegate to root provider
        return this.rootProvider.resolve(identifier);

      case ServiceLifetime.Scoped:
        return this.resolveScoped(descriptor, resolutionStack);

      case ServiceLifetime.Transient:
        return this.rootProvider.createInstance(descriptor, resolutionStack);

      default:
        throw new Error(`Unknown lifetime: ${descriptor.lifetime}`);
    }
  }

  /**
   * Resolve a scoped service (cached in this scope).
   */
  resolveScoped<T>(descriptor: IServiceDescriptor<T>, resolutionStack: string[]): T {
    const key = getServiceKey(descriptor.serviceIdentifier);

    // Check scope cache
    if (this.scopedCache.has(key)) {
      return this.scopedCache.get(key) as T;
    }

    // Create instance
    const instance = this.rootProvider.createInstance(descriptor, resolutionStack);

    // Cache in scope
    this.scopedCache.set(key, instance);

    // Track for disposal
    if (isDisposable(instance)) {
      this.disposables.push({ instance, key });
    }

    return instance;
  }

  /**
   * Ensure scope hasn't been disposed.
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new ScopeDisposedError();
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run a function within a new scope.
 *
 * @remarks
 * Convenience function that creates a scope, runs the callback,
 * and ensures disposal.
 *
 * @example
 * ```typescript
 * const result = await withScope(provider, async (scope) => {
 *   const uow = scope.resolve(IUnitOfWork);
 *   await doWork(uow);
 *   await uow.commit();
 *   return 'done';
 * });
 * ```
 */
export async function withScope<T>(
  provider: IServiceProvider,
  callback: (scope: IServiceScope) => T | Promise<T>,
): Promise<T> {
  const scope = provider.createScope();
  try {
    return await callback(scope);
  } finally {
    await scope.dispose();
  }
}

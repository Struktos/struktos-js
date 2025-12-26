/**
 * @fileoverview DI Errors - Dependency Injection Error Classes
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module defines error classes for DI-related failures.
 * Each error provides detailed debugging information including
 * dependency graphs and resolution paths.
 *
 * @version 1.0.0
 */

import { type ServiceIdentifier, getServiceName } from './service-identifier';
import { type ServiceLifetime, getLifetimeName } from './service-lifetime';

/**
 * Base error class for all DI-related errors.
 *
 * @remarks
 * All DI errors extend this class for consistent error handling:
 *
 * ```typescript
 * try {
 *   container.resolve(MyService);
 * } catch (error) {
 *   if (error instanceof DIError) {
 *     console.error('DI Error:', error.message);
 *     console.error('Resolution Path:', error.resolutionPath);
 *   }
 * }
 * ```
 */
export abstract class DIError extends Error {
  /**
   * The resolution path leading to this error.
   *
   * @remarks
   * Shows the chain of services being resolved when the error occurred:
   * ```
   * UserController -> UserService -> IUserRepository (FAILED)
   * ```
   */
  public readonly resolutionPath: string[];

  /**
   * Formatted dependency graph for debugging.
   *
   * @remarks
   * Visual representation of the dependency tree:
   * ```
   * UserController
   * ├─ UserService
   * │  ├─ IUserRepository (UNREGISTERED)
   * │  └─ ILogger (OK)
   * └─ IConfig (OK)
   * ```
   */
  public readonly dependencyGraph: string;

  constructor(message: string, resolutionPath: string[] = []) {
    super(message);
    this.name = this.constructor.name;
    this.resolutionPath = resolutionPath;
    this.dependencyGraph = this.buildDependencyGraph();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Build a visual dependency graph from the resolution path.
   * @internal
   */
  private buildDependencyGraph(): string {
    if (this.resolutionPath.length === 0) {
      return '';
    }

    const lines: string[] = [];
    for (let i = 0; i < this.resolutionPath.length; i++) {
      const indent = '  '.repeat(i);
      const prefix = i === 0 ? '' : '└─ ';
      lines.push(`${indent}${prefix}${this.resolutionPath[i]}`);
    }
    return lines.join('\n');
  }
}

/**
 * Error thrown when a requested service is not registered.
 *
 * @remarks
 * **Causes:**
 * - Service was never registered
 * - Service identifier typo
 * - Missing import/export
 *
 * **Solutions:**
 * 1. Register the service: `container.addScoped(MyService)`
 * 2. Check identifier spelling
 * 3. Ensure service module is imported
 *
 * @example
 * ```typescript
 * // This will throw ServiceNotRegisteredError
 * container.resolve(UnregisteredService);
 *
 * // Fix:
 * container.addScoped(UnregisteredService);
 * ```
 */
export class ServiceNotRegisteredError extends DIError {
  /**
   * The identifier that was not found.
   */
  public readonly serviceIdentifier: ServiceIdentifier;

  constructor(identifier: ServiceIdentifier, resolutionPath: string[] = []) {
    const name = getServiceName(identifier);
    const message =
      `Service '${name}' is not registered in the container. ` +
      `Did you forget to call container.add*(${name})?`;

    super(message, [...resolutionPath, `${name} (UNREGISTERED)`]);
    this.serviceIdentifier = identifier;
  }
}

/**
 * Error thrown when a circular dependency is detected.
 *
 * @remarks
 * **Example Circular Dependency:**
 * ```
 * ServiceA depends on ServiceB
 * ServiceB depends on ServiceC
 * ServiceC depends on ServiceA  ← CIRCULAR!
 * ```
 *
 * **Solutions:**
 * 1. Refactor to break the cycle
 * 2. Use lazy resolution (factory that defers resolution)
 * 3. Extract common dependency into a third service
 *
 * @example
 * ```typescript
 * // ServiceA -> ServiceB -> ServiceA = CIRCULAR!
 *
 * // Fix with lazy resolution:
 * class ServiceB {
 *   static inject = [] as const;
 *
 *   constructor(private resolver: IServiceResolver) {}
 *
 *   doWork() {
 *     const serviceA = this.resolver.resolve(ServiceA);
 *     serviceA.help();
 *   }
 * }
 * ```
 */
export class CircularDependencyError extends DIError {
  /**
   * The service that caused the cycle.
   */
  public readonly serviceIdentifier: ServiceIdentifier;

  /**
   * The full cycle path.
   */
  public readonly cyclePath: string[];

  constructor(identifier: ServiceIdentifier, resolutionPath: string[]) {
    const name = getServiceName(identifier);
    const cyclePath = [...resolutionPath, name];
    const cycleStr = cyclePath.join(' -> ');

    const message =
      `Circular dependency detected: ${cycleStr}\n\n` +
      `Resolution chain:\n${cyclePath
        .map((s, i) => `  ${' '.repeat(i * 2)}${i + 1}. ${s}`)
        .join('\n')}\n\nTo fix:\n` +
      `  1. Refactor to break the cycle\n` +
      `  2. Use a factory with lazy resolution\n` +
      `  3. Extract shared logic into a separate service`;

    super(message, [...resolutionPath, `${name} (CIRCULAR!)`]);
    this.serviceIdentifier = identifier;
    this.cyclePath = cyclePath;
  }
}

/**
 * Error thrown when a scope mismatch is detected.
 *
 * @remarks
 * **Invalid Dependencies:**
 * - ❌ Singleton → Scoped (captive dependency)
 * - ❌ Singleton → Transient (captive dependency)
 * - ❌ Scoped → Transient (captive dependency)
 *
 * **Why This Is a Problem:**
 *
 * A Singleton service captures a Scoped dependency:
 * - The Scoped service was created for Request A
 * - The Singleton holds a reference to it
 * - Request B uses the same Singleton
 * - Request B gets Request A's Scoped service!
 *
 * **Solutions:**
 * 1. Change the dependency's lifetime to match
 * 2. Inject a factory instead of the instance
 * 3. Use service locator pattern for runtime resolution
 *
 * @example
 * ```typescript
 * // ❌ BAD: Singleton with Scoped dependency
 * class SingletonService {
 *   static inject = [IScopedService] as const;
 *   constructor(private scoped: IScopedService) {} // CAPTURED!
 * }
 *
 * // ✅ GOOD: Inject factory instead
 * const IScopedServiceFactory = Symbol('IScopedServiceFactory');
 *
 * class SingletonService {
 *   static inject = [IScopedServiceFactory] as const;
 *   constructor(private factory: () => IScopedService) {}
 *
 *   doWork() {
 *     const scoped = this.factory(); // Fresh instance each time
 *   }
 * }
 * ```
 */
export class ScopeMismatchError extends DIError {
  /**
   * The dependent service identifier.
   */
  public readonly dependentIdentifier: ServiceIdentifier;

  /**
   * The dependency service identifier.
   */
  public readonly dependencyIdentifier: ServiceIdentifier;

  /**
   * Lifetime of the dependent service.
   */
  public readonly dependentLifetime: ServiceLifetime;

  /**
   * Lifetime of the dependency.
   */
  public readonly dependencyLifetime: ServiceLifetime;

  constructor(
    dependentId: ServiceIdentifier,
    dependencyId: ServiceIdentifier,
    dependentLifetime: ServiceLifetime,
    dependencyLifetime: ServiceLifetime,
    resolutionPath: string[] = [],
  ) {
    const dependentName = getServiceName(dependentId);
    const dependencyName = getServiceName(dependencyId);
    const dependentLifetimeName = getLifetimeName(dependentLifetime);
    const dependencyLifetimeName = getLifetimeName(dependencyLifetime);

    const message =
      `Scope mismatch: ${dependentLifetimeName} service '${dependentName}' ` +
      `cannot depend on ${dependencyLifetimeName} service '${dependencyName}'.\n\n` +
      `This would cause a "captive dependency" problem where the ` +
      `${dependentLifetimeName} captures and reuses an instance meant to be ${dependencyLifetimeName}.\n\n` +
      `To fix:\n` +
      `  1. Change '${dependencyName}' to ${dependentLifetimeName}\n` +
      `  2. Inject a factory: () => ${dependencyName}\n` +
      `  3. Change '${dependentName}' to ${dependencyLifetimeName}`;

    super(message, [
      ...resolutionPath,
      `${dependencyName} (${dependencyLifetimeName}) ← SCOPE MISMATCH`,
    ]);

    this.dependentIdentifier = dependentId;
    this.dependencyIdentifier = dependencyId;
    this.dependentLifetime = dependentLifetime;
    this.dependencyLifetime = dependencyLifetime;
  }
}

/**
 * Error thrown when resolving a Scoped service outside of a scope.
 *
 * @remarks
 * Scoped services require an active RequestContext and scope:
 *
 * ```typescript
 * // ❌ Will throw NoActiveScopeError
 * container.resolve(MyScopedService);
 *
 * // ✅ Correct - Inside scope
 * RequestContext.run({}, () => {
 *   const scope = container.createScope();
 *   scope.resolve(MyScopedService);
 * });
 * ```
 *
 * **Common Causes:**
 * - Resolving at application startup (before any request)
 * - Resolving in a background job without context
 * - Forgetting to create a scope
 *
 * **Solutions:**
 * 1. Wrap resolution in RequestContext.run()
 * 2. Create a scope before resolving
 * 3. Change service to Singleton if it doesn't need per-request isolation
 */
export class NoActiveScopeError extends DIError {
  /**
   * The scoped service that was requested.
   */
  public readonly serviceIdentifier: ServiceIdentifier;

  constructor(identifier: ServiceIdentifier, resolutionPath: string[] = []) {
    const name = getServiceName(identifier);

    const message =
      `Cannot resolve Scoped service '${name}' outside of a scope.\n\n` +
      `Scoped services require:\n` +
      `  1. An active RequestContext (RequestContext.run())\n` +
      `  2. An active service scope (container.createScope())\n\n` +
      `Example:\n` +
      `  RequestContext.run({}, () => {\n` +
      `    const scope = container.createScope();\n` +
      `    const service = scope.resolve(${name});\n` +
      `    scope.dispose();\n` +
      `  });`;

    super(message, [...resolutionPath, `${name} (NO SCOPE)`]);
    this.serviceIdentifier = identifier;
  }
}

/**
 * Error thrown when instance creation fails.
 *
 * @remarks
 * This wraps errors that occur during:
 * - Constructor execution
 * - Factory function execution
 * - Async initialization
 *
 * The original error is preserved as `cause`.
 */
export class ServiceCreationError extends DIError {
  /**
   * The service that failed to create.
   */
  public readonly serviceIdentifier: ServiceIdentifier;

  /**
   * The original error that caused creation to fail.
   */
  public readonly cause: Error;

  constructor(identifier: ServiceIdentifier, cause: Error, resolutionPath: string[] = []) {
    const name = getServiceName(identifier);

    const message =
      `Failed to create service '${name}': ${cause.message}\n\n` +
      `Original error:\n  ${cause.stack ?? cause.message}`;

    super(message, [...resolutionPath, `${name} (CREATION FAILED)`]);
    this.serviceIdentifier = identifier;
    this.cause = cause;
  }
}

/**
 * Error thrown when trying to use a disposed scope.
 */
export class ScopeDisposedError extends DIError {
  constructor() {
    super(
      'Cannot resolve services from a disposed scope. ' +
        'Create a new scope with container.createScope().',
    );
  }
}

/**
 * Error thrown when trying to modify a sealed container.
 */
export class ContainerSealedError extends DIError {
  constructor() {
    super(
      'Cannot register services after the container has been built. ' +
        'Register all services before calling buildServiceProvider().',
    );
  }
}

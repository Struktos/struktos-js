/**
 * @fileoverview Domain DI Module Exports
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module exports DI-related interfaces, types, and error classes.
 * These are technology-agnostic contracts that the Infrastructure layer implements.
 *
 * ## Zero-Reflection Pattern
 *
 * Struktos.js uses static inject properties instead of decorators:
 *
 * ```typescript
 * import { ServiceIdentifier, createToken } from '@struktos/core/domain/di';
 *
 * // Define interface token
 * interface ILogger { log(msg: string): void; }
 * const ILogger = createToken<ILogger>('ILogger');
 *
 * // Use in class
 * class UserService {
 *   static inject = [ILogger] as const;
 *   constructor(private logger: ILogger) {}
 * }
 * ```
 */

// ============================================================================
// Service Identifier
// ============================================================================

export {
  type ServiceIdentifier,
  type Constructor,
  type AbstractConstructor,
  type IInjectableConstructor,
  isServiceIdentifier,
  getServiceName,
  getServiceKey,
  hasInjectProperty,
  getInjectDependencies,
  createToken,
  // Pre-defined tokens
  SERVICE_PROVIDER_TOKEN,
  SERVICE_SCOPE_TOKEN,
} from './service-identifier';

// ============================================================================
// Service Lifetime
// ============================================================================

export {
  ServiceLifetime,
  isCacheable,
  getLifetimePriority,
  canDependOn,
  getLifetimeName,
} from './service-lifetime';

// ============================================================================
// Service Descriptor
// ============================================================================

export {
  type IServiceDescriptor,
  type IIServiceDescriptorOptions,
  type ServiceFactory,
  type IServiceResolver,
  createClassDescriptor,
  createFactoryDescriptor,
  createInstanceDescriptor,
  validateDescriptor,
} from './service-descriptor';

// ============================================================================
// DI Interfaces
// ============================================================================

export {
  type IDisposable,
  type IServiceCollection,
  type IServiceProvider,
  type IServiceScope,
  type IServiceScopeFactory,
  type IBuildOptions,
  isDisposable,
  SERVICE_SCOPE_FACTORY_TOKEN,
} from './di.interface';

// ============================================================================
// DI Errors
// ============================================================================

export {
  DIError,
  ServiceNotRegisteredError,
  CircularDependencyError,
  ScopeMismatchError,
  NoActiveScopeError,
  ServiceCreationError,
  ScopeDisposedError,
  ContainerSealedError,
} from './di.errors';

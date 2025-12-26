/**
 * @fileoverview @struktos/core - Main Entry Point
 *
 * Struktos.js Core Framework
 * Enterprise-grade Node.js framework with Hexagonal Architecture,
 * DDD, CQRS, and Unit of Work patterns.
 *
 * @packageDocumentation
 * @module @struktos/core
 * @version 1.0.0-alpha.1
 * @license Apache-2.0
 *
 * @example
 * ```typescript
 * import {
 *   RequestContext,
 *   ContextKey,
 *   TRACE_ID_KEY,
 *   createServiceCollection,
 *   ServiceLifetime,
 *   createToken,
 * } from '@struktos/core';
 *
 * // Define interface token
 * interface ILogger { log(msg: string): void; }
 * const ILogger = createToken<ILogger>('ILogger');
 *
 * // Register services
 * const services = createServiceCollection();
 * services.addSingleton(ILogger, ConsoleLogger);
 *
 * // Build and use
 * const provider = services.build();
 * const logger = provider.resolve(ILogger);
 * ```
 */

// ============================================================================
// Domain Layer Exports
// Pure business logic - NO external dependencies
// ============================================================================
export * from './domain';

// ============================================================================
// Application Layer Exports
// Use case orchestration, CQRS, DI
// ============================================================================
//export * from './application';

// ============================================================================
// Infrastructure Layer Exports
// External concerns, adapters, middleware
// ============================================================================
export * from './infrastructure';

// ============================================================================
// Common Exports
// Shared types, utilities, constants
// ============================================================================
//export * from './common';

// ============================================================================
// Convenience Re-exports (Most commonly used)
// ============================================================================

// Context
export {
  ContextKey,
  TRACE_ID_KEY,
  REQUEST_ID_KEY,
  USER_ID_KEY,
  TIMESTAMP_KEY,
  type IContext,
  type IContextProvider,
  type IStruktosContextData,
} from './domain/context';

export {
  RequestContext,
  RequestContextProvider,
  RequestContextProxy,
  getCurrentContext,
  requireContext,
} from './infrastructure/context';

export {
  AutoContextBehavior,
  type IPipelineBehavior,
  type IHandlerContext,
} from './application/context';

// DI - Domain types
export {
  type ServiceIdentifier,
  type Constructor,
  type IInjectableConstructor,
  ServiceLifetime,
  createToken,
  type IServiceCollection,
  type IServiceProvider,
  type IServiceScope,
  type IDisposable,
  type IServiceDescriptor,
  type ServiceFactory,
  // Errors
  DIError,
  ServiceNotRegisteredError,
  CircularDependencyError,
  ScopeMismatchError,
  NoActiveScopeError,
  // Tokens
  SERVICE_PROVIDER_TOKEN,
  SERVICE_SCOPE_TOKEN,
  SERVICE_SCOPE_FACTORY_TOKEN,
} from './domain/di';

// DI - Infrastructure implementations
export {
  ServiceCollection,
  createServiceCollection,
  ServiceProvider,
  ScopedContainer,
  withScope,
} from './infrastructure/di';

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.0-alpha.1';

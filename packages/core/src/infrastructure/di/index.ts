/**
 * @fileoverview Infrastructure DI Module Exports
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 *
 * This module exports the concrete DI container implementations.
 * Use these in your application's composition root.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   ServiceCollection,
 *   createServiceCollection,
 * } from '@struktos/core/infrastructure/di';
 *
 * // Create and configure services
 * const services = createServiceCollection();
 * services
 *   .addSingleton(ConfigService)
 *   .addScoped(IUnitOfWork, PrismaUnitOfWork)
 *   .addTransient(CreateUserHandler);
 *
 * // Build provider
 * const provider = services.build();
 *
 * // Use in application
 * RequestContext.run({}, () => {
 *   const scope = provider.createScope();
 *   const service = scope.resolve(UserService);
 *   scope.dispose();
 * });
 * ```
 */

// ============================================================================
// ServiceCollection - Service Registration
// ============================================================================

export { ServiceCollection, createServiceCollection } from './service-collection';

// ============================================================================
// ServiceProvider - Service Resolution
// ============================================================================

export { ServiceProvider } from './service-provider';

// ============================================================================
// ScopedContainer - Scoped Service Management
// ============================================================================

export { ScopedContainer, withScope } from './scoped-container';

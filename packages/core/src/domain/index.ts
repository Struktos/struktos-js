/**
 * @fileoverview Domain Layer Exports
 *
 * The Domain layer contains pure business logic that is technology-agnostic.
 * NO infrastructure dependencies are allowed here (Hexagonal Architecture).
 *
 * @module @struktos/core/domain
 * @license Apache-2.0
 */

// ============================================================================
// Context - Type-safe context propagation interfaces
// ============================================================================
export * from './context';

// ============================================================================
// DI - Dependency Injection interfaces and types
// ============================================================================
export * from './di';

// TODO: Export domain entities, value objects, and interfaces
// export * from './entities';
// export * from './repository';
// export * from './specification';
// export * from './events';

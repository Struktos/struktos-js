# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- CQRS Command/Query Bus implementation
- Domain Event Bus with pub/sub support
- PrismaUnitOfWork adapter
- CLI code generators

---

## [1.0.0-alpha.1] - 2024-12-26

### 🎉 Initial Alpha Release

This is the first alpha release of Struktos.js, introducing the core
infrastructure for building enterprise-grade applications with Hexagonal
Architecture.

### ✨ Features

#### Type-Safe Context Propagation System

- **feat(context):** Implement `RequestContext` with AsyncLocalStorage backend
  - Zero-configuration async context propagation across all execution boundaries
  - Automatic context inheritance in `Promise.all()`, `setTimeout()`, and async
    iterators
  - Thread-safe (async-safe) request isolation for concurrent request handling

- **feat(context):** Add `ContextKey<T>` for type-safe context access
  - Compile-time type checking eliminates string-based key errors
  - Support for default values and optional descriptions
  - Pre-defined keys: `TRACE_ID_KEY`, `REQUEST_ID_KEY`, `USER_ID_KEY`,
    `TIMESTAMP_KEY`

- **feat(context):** Implement `RequestContextProxy` for lazy resolution
  - Deferred context resolution for singleton services
  - Memory-efficient proxy pattern with configurable caching
  - Seamless integration with DI container

#### Hybrid Dependency Injection Engine

- **feat(di):** Implement zero-reflection DI container
  - `ServiceCollection` with fluent API for service registration
  - `ServiceProvider` as the resolution engine
  - `ScopedContainer` for per-request service isolation

- **feat(di):** Add `createToken<T>()` for type-safe service identifiers
  - Symbol-based tokens with full TypeScript inference
  - Support for both interface tokens and class constructors
  - Automatic dependency extraction from `static inject` arrays

- **feat(di):** Support all three service lifetimes
  - **Singleton:** Single instance shared across all requests
  - **Scoped:** New instance per `RequestContext` (per-request)
  - **Transient:** New instance on every resolution

- **feat(di):** Implement factory-based registrations
  - `addSingletonFactory()`, `addScopedFactory()`, `addTransientFactory()`
  - Access to resolver for conditional dependency injection
  - Support for async factory functions

- **feat(di):** Add comprehensive validation
  - Circular dependency detection with full cycle path reporting
  - Scope mismatch validation (Singleton → Scoped prevention)
  - Resolution stack tracking for debugging

#### DI + Context Integration

- **feat(di):** Integrate `ScopedContainer` with `RequestContext`
  - Same `RequestContext` guarantees same scope instance
  - Automatic scope cleanup on context disposal
  - `withScope()` helper for automatic scope management

- **feat(di):** Implement `IDisposable` support
  - Automatic disposal of scoped services on scope end
  - LIFO disposal order (reverse creation order)
  - Support for async disposal

#### Error Handling

- **feat(errors):** Add comprehensive error classes
  - `ServiceNotRegisteredError` with resolution path
  - `CircularDependencyError` with cycle visualization
  - `ScopeMismatchError` for lifetime violations
  - `NoActiveScopeError` for scope resolution outside context
  - `ContainerSealedError` for post-build registration attempts
  - `ContainerDisposedError` for use-after-dispose detection

### 🏗️ Architecture

- **arch:** Establish Hexagonal Architecture layer structure
  - `domain/` - Pure interfaces and types (zero dependencies)
  - `application/` - Application services and behaviors
  - `infrastructure/` - Concrete implementations

- **arch:** Configure dependency-cruiser for architecture validation
  - Enforce domain layer isolation
  - Prevent circular dependencies
  - Validate layer boundaries

### 🔧 Refactors

- **refactor(di):** Optimize `ServiceProvider.createScope()` for scope reuse
  - Same `RequestContext` now returns cached scope instance
  - Reduces memory allocation for nested service resolution
  - Maintains backward compatibility with explicit scope creation

- **refactor(context):** Improve `ContextKey` immutability
  - Readonly properties enforced at compile-time
  - `CONTEXT_KEY_BRAND` symbol for type guards
  - `ContextKey.isContextKey()` static method

### 🐛 Bug Fixes

- **fix(di):** Resolve `ServiceLifetime` import as value instead of type
- **fix(di):** Fix scope sharing within same `RequestContext`
- **fix(context):** Correct async test handling for auto-rollback scenarios

### 📝 Documentation

- **docs:** Add comprehensive TSDoc comments
  - All public APIs documented with examples
  - Architecture decisions explained in remarks
  - Usage patterns demonstrated in code blocks

### 🧪 Testing

- **test:** Achieve 82.4% overall test coverage
  - `domain/context`: 100% coverage
  - `domain/di`: 84.94% coverage
  - `infrastructure/context`: 76.69% coverage
  - `infrastructure/di`: 83.36% coverage

- **test:** Add 199 test cases across 6 test suites
  - Unit tests for all core components
  - Integration tests for DI + Context interaction
  - Stress tests for concurrent request handling

### 📦 Build & Tooling

- **build:** Configure tsup for dual CJS/ESM output
- **build:** Setup Turborepo for monorepo orchestration
- **build:** Configure Vitest with v8 coverage provider
- **ci:** Add ESLint flat config with TypeScript support
- **ci:** Configure Husky + lint-staged for pre-commit hooks
- **ci:** Setup commitlint for conventional commit enforcement

---

## Package Versions

| Package            | Version       | Status            |
| ------------------ | ------------- | ----------------- |
| `@struktos/core`   | 1.0.0-alpha.1 | 🟢 Published      |
| `@struktos/cli`    | -             | 🟡 In Development |
| `@struktos/prisma` | -             | 🟡 Planned        |

---

## Migration Guide

This is the initial release. No migration required.

---

## Contributors

- Jinhyeok Kim ([@jinhyeok](https://github.com/jinhyeok)) - Project Lead &
  Architecture

---

## Links

- [Documentation](https://struktos.dev/docs)
- [API Reference](https://struktos.dev/api)
- [GitHub Repository](https://github.com/struktos/struktos-platform)
- [NPM Package](https://www.npmjs.com/package/@struktos/core)

---

[Unreleased]:
  https://github.com/struktos/struktos-platform/compare/v1.0.0-alpha.1...HEAD
[1.0.0-alpha.1]:
  https://github.com/struktos/struktos-platform/releases/tag/v1.0.0-alpha.1

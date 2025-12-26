# Contributing to Struktos.js

First off, thank you for considering contributing to Struktos.js! 🎉

This document provides guidelines and steps for contributing. Following these
guidelines helps maintainers and the community understand your contribution and
work with you effectively.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Commit Convention](#commit-convention)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

---

## Code of Conduct

This project adheres to the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating,
you are expected to uphold this code.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0
- **Git**

### Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/struktos/struktos-js.git
cd struktos-js

# 3. Add upstream remote
git remote add upstream https://github.com/struktos/struktos-js.git

# 4. Install dependencies
pnpm install

# 5. Build all packages
pnpm build

# 6. Run tests to verify setup
pnpm test
```

---

## Development Workflow

### Branch Naming

Use descriptive branch names:

```
feat/context-propagation
fix/circular-dependency-detection
docs/api-reference
refactor/di-engine
test/scoped-container
```

### Development Commands

```bash
# Start development mode (watch for changes)
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific package
pnpm --filter @struktos/core test

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Format code
pnpm format

# Validate architecture
pnpm arch:validate
```

### Package-Specific Development

```bash
# Work on @struktos/core only
cd packages/core
pnpm dev
pnpm test:watch
```

---

## Pull Request Process

### 1. Create a Changeset

Before creating a PR, add a changeset to describe your changes:

```bash
pnpm changeset
```

This will prompt you to:

1. Select changed packages
2. Choose version bump type (major/minor/patch)
3. Write a summary of changes

### 2. Pre-PR Checklist

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`pnpm test`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Architecture validation passes (`pnpm arch:validate`)
- [ ] Changeset added for user-facing changes
- [ ] Documentation updated if needed

### 3. Create Pull Request

1. Push your branch to your fork
2. Create a PR against `main` branch
3. Fill out the PR template
4. Wait for CI checks to pass
5. Request review from maintainers

### 4. PR Review Process

- PRs require at least one approval from maintainers
- All CI checks must pass
- Conversations must be resolved
- Maintainers may request changes

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit
messages.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Formatting, missing semicolons, etc.                    |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `build`    | Build system or external dependencies                   |
| `ci`       | CI configuration                                        |
| `chore`    | Other changes that don't modify src or test files       |

### Scopes

| Scope     | Description                 |
| --------- | --------------------------- |
| `core`    | @struktos/core package      |
| `cli`     | @struktos/cli package       |
| `prisma`  | @struktos/prisma package    |
| `context` | Context propagation module  |
| `di`      | Dependency injection module |
| `deps`    | Dependencies                |

### Examples

```bash
# Feature
feat(di): add factory-based service registration

# Bug fix
fix(context): resolve async boundary propagation issue

# Documentation
docs(readme): add usage examples for RequestContext

# Breaking change (use ! after type)
feat(di)!: change ServiceCollection API to fluent pattern

BREAKING CHANGE: ServiceCollection.register() removed.
Use addSingleton(), addScoped(), addTransient() instead.
```

---

## Coding Standards

### TypeScript

```typescript
// ✅ Good: Use explicit types for public APIs
export function createToken<T>(name: string): ServiceToken<T> {
  return Symbol(name) as ServiceToken<T>;
}

// ❌ Bad: Implicit any
export function createToken(name) {
  return Symbol(name);
}
```

### Documentation

````typescript
/**
 * Creates a type-safe service token for dependency injection.
 *
 * @template T - The service type this token represents
 * @param name - Descriptive name for debugging
 * @returns A unique symbol that serves as the service identifier
 *
 * @example
 * ```typescript
 * interface ILogger {
 *   log(message: string): void;
 * }
 *
 * const ILogger = createToken<ILogger>('ILogger');
 * ```
 *
 * @see {@link ServiceCollection.addSingleton} for registration
 */
export function createToken<T>(name: string): ServiceToken<T>;
````

### Architecture Rules

1. **Domain Layer** - Pure interfaces, no external dependencies
2. **Application Layer** - Use cases, depends only on Domain
3. **Infrastructure Layer** - Implementations, can depend on anything

```typescript
// ✅ Domain layer (packages/core/src/domain/)
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
}

// ✅ Infrastructure layer (packages/core/src/infrastructure/)
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

---

## Testing Guidelines

### Test Structure

```typescript
describe('ServiceProvider', () => {
  // Setup
  let services: ServiceCollection;
  let provider: IServiceProvider;

  beforeEach(() => {
    services = new ServiceCollection();
  });

  // Group related tests
  describe('resolve - basic', () => {
    it('should resolve singleton service', () => {
      // Arrange
      services.addSingleton(ILogger, ConsoleLogger);
      provider = services.build();

      // Act
      const logger = provider.resolve(ILogger);

      // Assert
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });
  });

  describe('error handling', () => {
    it('should throw ServiceNotRegisteredError for unregistered service', () => {
      provider = services.build();

      expect(() => {
        provider.resolve(ILogger);
      }).toThrow(ServiceNotRegisteredError);
    });
  });
});
```

### Coverage Requirements

| Layer          | Minimum |
| -------------- | ------- |
| Domain         | 95%     |
| Application    | 85%     |
| Infrastructure | 80%     |

### Running Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Specific file
pnpm --filter @struktos/core test tests/unit/di/service-provider.spec.ts
```

---

## Documentation

### TSDoc Comments

All public APIs must have TSDoc comments:

````typescript
/**
 * Brief description in one sentence.
 *
 * @remarks
 * Detailed explanation of behavior, design decisions,
 * and any important notes.
 *
 * @param paramName - Description
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * ```typescript
 * // Example code
 * ```
 *
 * @see {@link RelatedClass}
 * @since 1.0.0
 */
````

### README Updates

When adding new features, update:

- Package README.md
- Root README.md (if significant)
- API documentation

---

## Release Process

### For Contributors

1. Add changesets for your changes
2. Merge PR to `main`
3. Changesets bot creates a "Version Packages" PR
4. Maintainers review and merge the version PR
5. Packages are automatically published to NPM

### Version Bump Guidelines

| Change Type                       | Version Bump |
| --------------------------------- | ------------ |
| Bug fix, patch                    | `patch`      |
| New feature (backward compatible) | `minor`      |
| Breaking change                   | `major`      |

### Pre-release Versions

For alpha/beta releases:

```bash
# Create pre-release changeset
pnpm changeset pre enter alpha
pnpm changeset
pnpm changeset version
pnpm release
pnpm changeset pre exit
```

---

## Questions?

- Open a
  [GitHub Discussion](https://github.com/struktos/struktos-js/discussions)
- Join our [Discord](https://discord.gg/struktos)

---

Thank you for contributing to Struktos.js! 🚀

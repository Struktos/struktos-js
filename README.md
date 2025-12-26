<div align="center">

# 🏛️ Struktos.js

### Architecture Development as a Service (ADaaS) Platform

**Enterprise-grade TypeScript framework for building scalable, maintainable
applications with Hexagonal Architecture**

[![CI](https://github.com/struktos/struktos-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/struktos/struktos-platform/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/struktos/struktos-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/struktos/struktos-platform)
[![npm version](https://img.shields.io/npm/v/@struktos/core.svg)](https://www.npmjs.com/package/@struktos/core)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Documentation](https://struktos.dev/docs) •
[API Reference](https://struktos.dev/api) •
[Examples](https://github.com/struktos/examples) •
[Discord](https://discord.gg/struktos)

</div>

---

## 🎯 Why Struktos.js?

Modern enterprise applications demand **clean architecture**, **type safety**,
and **scalability**. Struktos.js delivers all three by bringing proven patterns
from Go's context propagation and C# ASP.NET's DI system to the Node.js
ecosystem.

### The Problem

```typescript
// ❌ Traditional approach: Scattered context, tight coupling
async function handleRequest(req: Request) {
  const userId = req.headers['x-user-id']; // Manual propagation
  const traceId = req.headers['x-trace-id']; // Error-prone
  const db = new PostgresDatabase(); // Hard dependency
  const logger = new ConsoleLogger(); // No abstraction

  await db.query(/* ... */); // How to track? How to test?
}
```

### The Struktos.js Solution

```typescript
// ✅ Struktos.js: Type-safe context, decoupled architecture
import { RequestContext, ServiceCollection, createToken } from '@struktos/core';

// 1. Define interfaces (Ports)
const IDatabase = createToken<IDatabase>('IDatabase');
const ILogger = createToken<ILogger>('ILogger');

// 2. Register implementations (Adapters)
const services = new ServiceCollection()
  .addSingleton(ILogger, ConsoleLogger)
  .addScoped(IDatabase, PostgresDatabase); // Per-request isolation

const container = services.build();

// 3. Handle request with automatic context propagation
app.use(async (req, res, next) => {
  await RequestContext.run(
    {
      traceId: req.headers['x-trace-id'] ?? crypto.randomUUID(),
      userId: req.user?.id,
    },
    async () => {
      const scope = container.createScope();
      try {
        await next();
      } finally {
        scope.dispose(); // Automatic cleanup
      }
    },
  );
});

// 4. Access context anywhere in the call stack
class OrderService {
  static inject = [IDatabase, ILogger] as const;

  constructor(
    private db: IDatabase,
    private logger: ILogger,
  ) {}

  async createOrder(data: CreateOrderDTO) {
    const ctx = RequestContext.current()!;
    this.logger.info(
      `[${ctx.get('traceId')}] Creating order for user ${ctx.get('userId')}`,
    );
    // Context automatically propagates through async boundaries!
  }
}
```

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🔄 Type-Safe Context Propagation

- **AsyncLocalStorage-based** request context
- **Zero-reflection** dependency injection
- **Automatic propagation** across async boundaries
- **RequestContextProxy** for lazy resolution

</td>
<td width="50%">

### 🏗️ Hexagonal Architecture

- **Ports & Adapters** pattern enforcement
- **Domain-centric** design
- **Technology-agnostic** core
- **Build-time** architecture validation

</td>
</tr>
<tr>
<td>

### ⚡ High-Performance DI Engine

- **Static inject** pattern (no decorators)
- **Singleton/Scoped/Transient** lifecycles
- **Circular dependency** detection
- **Scope mismatch** validation

</td>
<td>

### 🛡️ Enterprise Patterns

- **Unit of Work** with auto-rollback
- **CQRS** command/query separation
- **Repository** pattern
- **Specification** pattern

</td>
</tr>
</table>

---

## 📦 Installation

```bash
# Using npm
npm install @struktos/core

# Using pnpm (recommended)
pnpm add @struktos/core

# Using yarn
yarn add @struktos/core
```

---

## 🚀 Quick Start

### 1. Define Your Domain Interfaces (Ports)

```typescript
// domain/ports/user.repository.ts
import { createToken } from '@struktos/core';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export const IUserRepository = createToken<IUserRepository>('IUserRepository');
```

### 2. Implement Infrastructure Adapters

```typescript
// infrastructure/repositories/prisma-user.repository.ts
import { IUserRepository } from '../../domain/ports/user.repository';

export class PrismaUserRepository implements IUserRepository {
  static inject = [IDatabase, ILogger] as const;

  constructor(
    private db: IDatabase,
    private logger: ILogger,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async save(user: User): Promise<void> {
    await this.db.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }
}
```

### 3. Configure the DI Container

```typescript
// app/container.ts
import { ServiceCollection } from '@struktos/core';

export function configureServices() {
  return (
    new ServiceCollection()
      // Singletons - Shared across all requests
      .addSingleton(ILogger, ConsoleLogger)
      .addSingleton(IConfig, ConfigService)

      // Scoped - New instance per request
      .addScoped(IDatabase, PrismaDatabase)
      .addScoped(IUserRepository, PrismaUserRepository)
      .addScoped(IUnitOfWork, PrismaUnitOfWork)

      // Transient - New instance every time
      .addTransient(IEmailService, SmtpEmailService)

      // Factory registration
      .addScopedFactory(ICurrentUser, (resolver) => {
        const ctx = RequestContext.current();
        return ctx?.get('user') ?? AnonymousUser;
      })

      .build({ validateScopes: true })
  );
}
```

### 4. Handle Requests with Context

```typescript
// main.ts
import { RequestContext } from '@struktos/core';

const container = configureServices();

app.use(async (req, res, next) => {
  await RequestContext.run(
    {
      traceId: req.headers['x-request-id'] ?? crypto.randomUUID(),
      userId: req.user?.id,
      startTime: Date.now(),
    },
    async () => {
      const scope = container.createScope();

      try {
        // All services resolved within this scope share the same RequestContext
        req.scope = scope;
        await next();
      } finally {
        // Automatic cleanup: disposes all scoped services
        // UnitOfWork auto-rollback if not committed
        scope.dispose();
      }
    },
  );
});

// In your route handler
app.post('/orders', async (req, res) => {
  const orderService = req.scope.resolve(OrderService);
  const result = await orderService.createOrder(req.body);
  res.json(result);
});
```

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                          APPLICATION                               │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                         DOMAIN                               │  │  │
│  │  │                                                              │  │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │  │
│  │  │  │  Entities   │  │ Value Objects│  │  Domain Events   │   │  │  │
│  │  │  └─────────────┘  └──────────────┘  └──────────────────┘   │  │  │
│  │  │                                                              │  │  │
│  │  │  ┌─────────────────────────────────────────────────────┐   │  │  │
│  │  │  │            Ports (Interfaces)                        │   │  │  │
│  │  │  │  IUserRepository │ IOrderService │ IEventBus        │   │  │  │
│  │  │  └─────────────────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐    │  │
│  │  │   Use Cases     │  │    CQRS      │  │  DI Container     │    │  │
│  │  │  (Commands/     │  │  Handlers    │  │  ServiceProvider  │    │  │
│  │  │   Queries)      │  │              │  │  ScopedContainer  │    │  │
│  │  └─────────────────┘  └──────────────┘  └───────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │     Adapters       │  │   RequestContext │  │  External APIs    │   │
│  │  (Repositories,    │  │  AsyncLocalStore │  │  (HTTP, gRPC,     │   │
│  │   Controllers)     │  │  Context Proxy   │  │   Message Queue)  │   │
│  └────────────────────┘  └──────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

| Principle                 | Description                                          | Struktos.js Implementation                  |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| **Dependency Inversion**  | High-level modules don't depend on low-level modules | `createToken<T>()` creates interface tokens |
| **Single Responsibility** | Each class has one reason to change                  | Separated Domain/Application/Infrastructure |
| **Open/Closed**           | Open for extension, closed for modification          | Adapter pattern for implementations         |
| **Interface Segregation** | Many specific interfaces over general ones           | Fine-grained service tokens                 |
| **Liskov Substitution**   | Subtypes must be substitutable                       | Strict TypeScript interface contracts       |

---

## 📊 Monorepo Structure

```
struktos-platform/
├── packages/
│   ├── core/                    # @struktos/core
│   │   ├── src/
│   │   │   ├── domain/          # Pure interfaces & types
│   │   │   │   ├── context/     # ContextKey, IContext
│   │   │   │   └── di/          # ServiceIdentifier, IServiceProvider
│   │   │   ├── application/     # Application services
│   │   │   │   └── context/     # Context behaviors
│   │   │   └── infrastructure/  # Concrete implementations
│   │   │       ├── context/     # RequestContext, ContextProxy
│   │   │       └── di/          # ServiceCollection, ServiceProvider
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   │
│   ├── cli/                     # @struktos/cli - Code generators
│   ├── prisma/                  # @struktos/prisma - Prisma adapters
│   └── adapters/                # HTTP, gRPC, Queue adapters
│
├── apps/
│   ├── docs/                    # Documentation site
│   └── examples/                # Example applications
│
├── turbo.json                   # Turborepo configuration
├── pnpm-workspace.yaml          # Workspace definition
└── .github/workflows/           # CI/CD pipelines
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @struktos/core test

# Watch mode
pnpm test:watch
```

### Coverage Requirements

| Layer          | Minimum Coverage | Current   |
| -------------- | ---------------- | --------- |
| Domain         | 95%              | 100%      |
| Application    | 85%              | 86.36%    |
| Infrastructure | 80%              | 82.4%     |
| **Overall**    | **80%**          | **82.4%** |

---

## 🛡️ Architecture Validation

Struktos.js enforces architectural rules at build time using
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser):

```bash
# Validate architecture rules
pnpm arch:validate

# Generate dependency graph
pnpm arch:graph
```

### Enforced Rules

- ✅ **Domain** layer has ZERO external dependencies
- ✅ **Application** depends only on Domain interfaces
- ✅ **Infrastructure** implements Domain interfaces
- ✅ No circular dependencies between modules
- ✅ Scoped services cannot be injected into Singletons

---

## 📚 Documentation

- [**Getting Started**](https://struktos.dev/docs/getting-started) - Quick start
  guide
- [**Core Concepts**](https://struktos.dev/docs/concepts) - RequestContext, DI,
  Scopes
- [**API Reference**](https://struktos.dev/api) - Full API documentation
- [**Examples**](https://github.com/struktos/examples) - Real-world examples
- [**Migration Guide**](https://struktos.dev/docs/migration) - Migrate from
  other frameworks

---

## 🗺️ Roadmap

- [x] **v1.0.0-alpha.1** - Core DI + RequestContext
- [ ] **v1.0.0-alpha.2** - CQRS + Event Bus
- [ ] **v1.0.0-beta.1** - Prisma UnitOfWork + CLI generators
- [ ] **v1.0.0-rc.1** - Full documentation + Examples
- [ ] **v1.0.0** - Production release

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/struktos-platform.git

# Install dependencies
pnpm install

# Create a branch
git checkout -b feature/amazing-feature

# Make changes and test
pnpm test

# Submit a PR
```

---

## 📄 License

[Apache License 2.0](LICENSE) - Free for commercial use, modification,
distribution, and private use.

---

## 💬 Community

- [Discord](https://discord.gg/struktos) - Chat with the community
- [GitHub Discussions](https://github.com/struktos/struktos-platform/discussions) -
  Ask questions
- [Twitter](https://twitter.com/struktosjs) - Follow for updates

---

<div align="center">

**Built with ❤️ by the Struktos.js Team**

[⬆ Back to Top](#-struktosjs)

</div>

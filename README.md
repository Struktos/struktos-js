# 🏛️ Struktos.js ADaaS Platform

> **A**rchitecture **D**evelopment **a**s **a** **S**ervice - 차세대 자율 운영
> 아키텍처 플랫폼

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.7.0-blue.svg)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg)](https://pnpm.io)

---

## 📐 Vision

Struktos.js는 **헥사고날 아키텍처(Hexagonal Architecture)** 원칙을 100% 준수하는
엔터프라이즈급 Node.js 프레임워크입니다. H100 100대 규모의 AI 클러스터, 1,000만
토큰 컨텍스트, 그리고 **SKNUL(Struktos Networking Ultra Link)** 차세대
프로토콜을 포함한 ADaaS 플랫폼을 구축합니다.

---

## 🗂️ Monorepo Structure

```
struktos-platform/
├── apps/                          # Production Applications
│   ├── baas-api/                  # Backend as a Service API
│   ├── data-engine/               # AI-powered Data Engine
│   └── marketplace-web/           # Component Marketplace
│
├── packages/                      # Reusable Packages
│   ├── core/                      # @struktos/core - Hexagonal Framework
│   ├── sknul/                     # @struktos/sknul - SKNUL Protocol
│   ├── cli/                       # @struktos/cli - CLI Tools
│   ├── architecture/              # @struktos/architecture - Arch Rules
│   ├── resilience/                # @struktos/resilience - Resilience Patterns
│   └── shared/                    # @struktos/shared - Common Utilities
│
├── tools/                         # Development Tools & Scripts
│
├── turbo.json                     # Turborepo Configuration
├── pnpm-workspace.yaml            # pnpm Workspace Definition
├── tsconfig.base.json             # Shared TypeScript Config
├── eslint.config.js               # ESLint Flat Config
├── .dependency-cruiser.js         # Architecture Guard Rules
└── vitest.workspace.ts            # Vitest Workspace Config
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/struktos/struktos-platform.git
cd struktos-platform

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

---

## 📋 Available Scripts

| Script                  | Description                 |
| ----------------------- | --------------------------- |
| `pnpm build`            | Build all packages and apps |
| `pnpm build:packages`   | Build packages only         |
| `pnpm build:apps`       | Build applications only     |
| `pnpm dev`              | Start development mode      |
| `pnpm test`             | Run all tests               |
| `pnpm test:unit`        | Run unit tests              |
| `pnpm test:integration` | Run integration tests       |
| `pnpm test:coverage`    | Run tests with coverage     |
| `pnpm lint`             | Lint all code               |
| `pnpm lint:fix`         | Fix linting issues          |
| `pnpm format`           | Format code with Prettier   |
| `pnpm typecheck`        | TypeScript type checking    |
| `pnpm arch:validate`    | Validate architecture rules |
| `pnpm arch:graph`       | Generate dependency graph   |
| `pnpm clean`            | Clean all build artifacts   |

---

## 🏗️ Architecture Principles

### Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     APPLICATION                          │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │                    DOMAIN                        │   │   │
│  │  │                                                  │   │   │
│  │  │    Entities │ Value Objects │ Domain Events     │   │   │
│  │  │                                                  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │    Use Cases │ CQRS │ DI Container │ Ports (Interfaces) │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│    Adapters │ Middleware │ Repository Impl │ External APIs      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5대 핵심 패턴

1. **Unit of Work (UoW)** - 트랜잭션 관리
2. **CQRS** - Command/Query Responsibility Segregation
3. **Repository** - 데이터 액세스 추상화
4. **Service** - 비즈니스 로직 캡슐화
5. **Specification** - 비즈니스 규칙 표현

---

## 🛡️ Architecture Guard

Dependency Cruiser로 아키텍처 규칙을 빌드 타임에 강제합니다.

```bash
# 아키텍처 규칙 검증
pnpm arch:validate

# 의존성 그래프 생성
pnpm arch:graph
```

### Enforced Rules

- ✅ Domain NEVER depends on Application or Infrastructure
- ✅ Application NEVER depends on Infrastructure (concrete impl)
- ✅ No circular dependencies between packages
- ✅ Core package MUST NOT depend on adapters

---

## 🧪 Testing Strategy

| Layer          | Test Type   | Isolation              |
| -------------- | ----------- | ---------------------- |
| Domain         | Unit        | 100% isolated          |
| Application    | Unit        | Mocked infrastructure  |
| Infrastructure | Integration | Real/Mock dependencies |
| Apps           | E2E         | Full stack             |

**Coverage Threshold:** 70% minimum (enterprise requirement)

---

## 📦 Package Details

### @struktos/core

Core framework with Hexagonal Architecture support:

- `IUnitOfWork`, `IUnitOfWorkFactory` - Transaction management
- `ICommand`, `IQuery`, `ICommandHandler`, `IQueryHandler` - CQRS
- `IServiceCollection`, `@Injectable`, `@Inject` - DI
- `IDomainEvent`, `IEventBus` - Domain events
- `ISpecification` - Specification pattern

### @struktos/sknul

**SKNUL (Struktos Networking Ultra Link)** - 차세대 네트워킹 프로토콜

- H100 클러스터 최적화
- 1,000만 토큰 컨텍스트 지원
- 초저지연 통신

### @struktos/cli

CLI tool for project scaffolding:

- `struktos new <project>` - Create new project
- `struktos generate:entity` - Generate entity
- `struktos generate:usecase` - Generate use case

---

## 📄 License

[Apache License 2.0](LICENSE)

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

<p align="center">
  <strong>Built with ❤️ by the Struktos.js Team</strong>
</p>

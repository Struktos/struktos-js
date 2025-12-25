// ============================================================================
// Struktos.js ADaaS Platform - Dependency Cruiser Configuration
// ============================================================================
//
// 🎯 Purpose:
// Enforces Hexagonal Architecture boundaries at build time. This configuration
// acts as an "Architecture Guard" that prevents violations of the clean
// architecture principles that Struktos.js mandates.
//
// 🏛️ ADaaS Vision Alignment:
// - Automated architecture compliance checking
// - Prevents technical debt accumulation
// - Enforces dependency direction rules
//
// 📐 Hexagonal Architecture Rules:
// - RULE 1: Domain layer NEVER depends on Application or Infrastructure
// - RULE 2: Application layer NEVER depends on Infrastructure
// - RULE 3: packages/core MUST NOT depend on adapters
// - RULE 4: No circular dependencies between packages
//
// CLI Commands:
// - Validate: pnpm arch:validate
// - Generate Graph: pnpm arch:graph
//
// ============================================================================

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    // ─────────────────────────────────────────────────────────────────────────
    // RULE 1: Domain Layer Isolation (CRITICAL)
    // The Domain layer contains pure business logic and MUST NOT depend on
    // any external concerns. This is the heart of Hexagonal Architecture.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-domain-to-infrastructure',
      comment: `
        Domain layer MUST NOT depend on Infrastructure layer.
        
        Hexagonal Architecture Principle:
        Domain contains pure business logic that is technology-agnostic.
        Infrastructure concerns (databases, external APIs, frameworks)
        MUST be hidden behind Ports (interfaces) in the Application layer.
        
        FIX: Extract an interface (Port) in domain/ports and implement
        it in infrastructure/adapters.
      `,
      severity: 'error',
      from: {
        path: '^packages/[^/]+/src/domain',
      },
      to: {
        path: ['^packages/[^/]+/src/infrastructure', '^packages/[^/]+/src/adapters'],
      },
    },
    {
      name: 'no-domain-to-application',
      comment: `
        Domain layer MUST NOT depend on Application layer.
        
        Hexagonal Architecture Principle:
        Domain is the innermost layer. Dependencies flow INWARD only.
        Application layer orchestrates domain objects but domain
        remains independent.
        
        FIX: Move shared logic to domain or extract a domain service.
      `,
      severity: 'error',
      from: {
        path: '^packages/[^/]+/src/domain',
      },
      to: {
        path: '^packages/[^/]+/src/application',
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 2: Application Layer Boundaries
    // Application layer orchestrates use cases but MUST NOT contain
    // infrastructure-specific code.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-application-to-infrastructure-impl',
      comment: `
        Application layer MUST NOT import concrete Infrastructure implementations.
        
        Hexagonal Architecture Principle:
        Application layer should only depend on Ports (interfaces).
        Concrete adapters are injected via Dependency Injection at runtime.
        
        FIX: Import the interface (Port) instead of the concrete class.
        Register the implementation in your DI container.
      `,
      severity: 'error',
      from: {
        path: '^packages/[^/]+/src/application',
      },
      to: {
        path: ['^packages/[^/]+/src/infrastructure/(?!index)', '^packages/[^/]+/src/adapters/'],
        pathNot: [
          // Allow importing types from infrastructure index
          '^packages/[^/]+/src/infrastructure/index\\.ts$',
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 3: Core Package Independence
    // @struktos/core is the foundation and MUST NOT depend on adapters.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-core-to-adapters',
      comment: `
        @struktos/core MUST NOT depend on any adapter packages.
        
        ADaaS Platform Principle:
        Core provides interfaces (Ports) that adapters implement.
        Core is technology-agnostic and defines the contracts.
        
        Adapter packages: @struktos/adapter-*, @struktos/prisma, etc.
      `,
      severity: 'error',
      from: {
        path: '^packages/core/',
      },
      to: {
        path: ['^packages/adapter-', '^packages/prisma/'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 4: No Circular Dependencies
    // Circular dependencies create tight coupling and break modularity.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-circular',
      comment: `
        Circular dependencies are forbidden.
        
        ADaaS Platform Principle:
        Circular dependencies create tight coupling, make testing difficult,
        and can cause runtime issues. They indicate a design problem.
        
        FIX: Extract shared code to a common module or refactor the
        dependency direction.
      `,
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 5: No Orphan Modules
    // Every module should be part of the dependency graph.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-orphans',
      comment: `
        No orphan modules allowed.
        
        Every module should either:
        1. Export something used elsewhere, OR
        2. Be an entry point (main, index)
        
        Orphan modules indicate dead code that should be removed.
      `,
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '\\.test\\.ts$',
          '\\.spec\\.ts$',
          '__tests__',
          '__mocks__',
          'index\\.ts$',
          'main\\.ts$',
        ],
      },
      to: {},
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 6: Apps Can Only Import from Packages
    // Applications should compose packages, not have cross-app dependencies.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-app-to-app',
      comment: `
        Applications MUST NOT import from other applications.
        
        ADaaS Platform Principle:
        Apps are deployment units that compose packages.
        Shared code belongs in packages, not apps.
        
        FIX: Extract shared code to packages/shared.
      `,
      severity: 'error',
      from: {
        path: '^apps/[^/]+/',
      },
      to: {
        path: '^apps/[^/]+/',
        pathNot: [
          // Allow importing from self
          '\\1',
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 7: SKNUL Protocol Independence
    // SKNUL is a standalone protocol and should minimize dependencies.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'sknul-minimal-deps',
      comment: `
        @struktos/sknul should have minimal external dependencies.
        
        SKNUL Protocol Principle:
        As a next-generation networking protocol, SKNUL should be
        as self-contained as possible for portability and security.
        
        Allowed: @struktos/core (for interfaces), @struktos/shared
      `,
      severity: 'warn',
      from: {
        path: '^packages/sknul/',
      },
      to: {
        path: '^packages/',
        pathNot: ['^packages/sknul/', '^packages/core/', '^packages/shared/'],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 8: No Direct Node.js Modules in Domain
    // Domain should be framework-agnostic.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-nodejs-in-domain',
      comment: `
        Domain layer SHOULD NOT directly use Node.js-specific modules.
        
        Hexagonal Architecture Principle:
        Domain logic should be portable across environments.
        Node.js specifics should be wrapped in infrastructure adapters.
        
        Exceptions: Standard ECMAScript APIs like crypto.
      `,
      severity: 'warn',
      from: {
        path: '^packages/[^/]+/src/domain',
      },
      to: {
        dependencyTypes: ['core'],
        pathNot: ['^node:crypto$', '^node:util$'],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled'],
    },

    exclude: {
      path: [
        'node_modules',
        '\\.d\\.ts$',
        '\\.test\\.ts$',
        '\\.spec\\.ts$',
        '__tests__',
        '__mocks__',
        'coverage',
        'dist',
        '\\.turbo',
      ],
    },

    includeOnly: {
      path: ['^packages/', '^apps/'],
    },

    tsPreCompilationDeps: true,

    tsConfig: {
      fileName: './tsconfig.base.json',
    },

    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['main', 'types'],
    },

    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
      },
      archi: {
        collapsePattern: '^packages/([^/]+)',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};

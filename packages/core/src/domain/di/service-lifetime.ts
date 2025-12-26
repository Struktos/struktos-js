/**
 * @fileoverview ServiceLifetime - Service Lifecycle Management
 *
 * @packageDocumentation
 * @module @struktos/core/domain/di
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: DOMAIN
 *
 * This module defines the service lifecycle scopes that control when
 * service instances are created and destroyed.
 *
 * ## Integration with RequestContext
 *
 * The `Scoped` lifetime is intrinsically tied to `RequestContext`:
 *
 * ```
 * RequestContext.run({}, async () => {
 *   // Scoped services share instances within this scope
 *   const scope = provider.createScope();
 *   const service1 = scope.resolve(MyScopedService);
 *   const service2 = scope.resolve(MyScopedService);
 *   // service1 === service2
 * });
 * ```
 *
 * @version 1.0.0
 */

/**
 * ServiceLifetime - Defines when service instances are created and destroyed.
 *
 * @remarks
 * **Lifecycle Overview:**
 *
 * | Lifetime | Created | Shared | Destroyed |
 * |----------|---------|--------|-----------|
 * | Singleton | First request | Globally | App shutdown |
 * | Scoped | First request in scope | Within scope | Scope disposal |
 * | Transient | Every request | Never | GC collected |
 *
 * **Memory and Performance Impact:**
 *
 * | Lifetime | Memory | Performance | Thread Safety |
 * |----------|--------|-------------|---------------|
 * | Singleton | Minimal | Best | REQUIRED |
 * | Scoped | Medium | Good | Not required |
 * | Transient | High | Worst | Not required |
 *
 * **Dependency Rules:**
 *
 * To prevent captive dependency issues:
 *
 * - ✅ Singleton can inject: Singleton
 * - ✅ Scoped can inject: Singleton, Scoped
 * - ✅ Transient can inject: Singleton, Scoped, Transient
 * - ❌ Singleton CANNOT inject: Scoped, Transient
 * - ❌ Scoped CANNOT inject: Transient (usually)
 *
 * @example Choosing the right lifetime
 * ```typescript
 * // SINGLETON: Shared, stateless, expensive to create
 * container.addSingleton(IConfig, EnvironmentConfig);
 * container.addSingleton(IEventBus, InMemoryEventBus);
 *
 * // SCOPED: Per-request, holds request state
 * container.addScoped(IUnitOfWork, PrismaUnitOfWork);
 * container.addScoped(IUserRepository, UserRepository);
 *
 * // TRANSIENT: Always new, isolated execution
 * container.addTransient(CreateUserHandler);
 * container.addTransient(SendEmailHandler);
 * ```
 */
export enum ServiceLifetime {
  /**
   * Singleton: Single instance shared across the entire application.
   *
   * @remarks
   * **Characteristics:**
   * - Created once on first resolution
   * - Lives until application shutdown
   * - Shared across ALL requests
   * - MUST be thread-safe (async-safe)
   *
   * **Use Cases:**
   * - Configuration services
   * - Logging infrastructure
   * - Connection pools
   * - Event buses
   * - Stateless utilities
   *
   * **⚠️ Warning:**
   *
   * Never store request-specific state in singletons:
   *
   * ```typescript
   * // ❌ DANGEROUS - Race condition!
   * class BadService {
   *   private currentUser: User;  // Shared across requests!
   *   setUser(user: User) { this.currentUser = user; }
   * }
   *
   * // ✅ SAFE - Use RequestContext
   * class GoodService {
   *   static inject = [] as const;
   *
   *   getCurrentUser(): User | undefined {
   *     return RequestContext.current()?.get(USER_KEY);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * class ConfigService {
   *   private readonly config: AppConfig;
   *
   *   constructor() {
   *     this.config = loadConfigFromEnv();
   *   }
   *
   *   get(key: string): string | undefined {
   *     return this.config[key];
   *   }
   * }
   *
   * container.addSingleton(ConfigService);
   * ```
   */
  Singleton = 'singleton',

  /**
   * Scoped: One instance per request/scope, tied to RequestContext.
   *
   * @remarks
   * **Characteristics:**
   * - Created once per scope (typically per HTTP request)
   * - Lives until scope is disposed
   * - Shared within the same scope
   * - Automatically cleaned up with scope
   *
   * **Critical Integration with RequestContext:**
   *
   * Scoped services require an active RequestContext:
   *
   * ```typescript
   * // ❌ Error - No RequestContext
   * const scope = provider.createScope();
   *
   * // ✅ Correct - Inside RequestContext
   * RequestContext.run({}, () => {
   *   const scope = provider.createScope();
   *   // Scoped services work correctly here
   * });
   * ```
   *
   * **Use Cases:**
   * - Database contexts (one transaction per request)
   * - Unit of Work pattern
   * - Request-specific loggers
   * - User session services
   *
   * **Automatic Disposal:**
   *
   * Services implementing `IDisposable` are disposed when scope ends:
   *
   * ```typescript
   * class DatabaseContext implements IDisposable {
   *   private connection: Connection;
   *
   *   dispose(): void {
   *     this.connection.close();  // Called automatically!
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * const IUnitOfWork = Symbol('IUnitOfWork');
   *
   * class PrismaUnitOfWork implements IUnitOfWork, IDisposable {
   *   private transaction?: PrismaTransaction;
   *
   *   async begin(): Promise<void> {
   *     this.transaction = await this.prisma.$transaction();
   *   }
   *
   *   async commit(): Promise<void> {
   *     await this.transaction?.commit();
   *   }
   *
   *   dispose(): void {
   *     // Rollback uncommitted transaction
   *     if (this.transaction?.isActive()) {
   *       this.transaction.rollback();
   *     }
   *   }
   * }
   *
   * container.addScoped(IUnitOfWork, PrismaUnitOfWork);
   * ```
   */
  Scoped = 'scoped',

  /**
   * Transient: New instance created on every resolution.
   *
   * @remarks
   * **Characteristics:**
   * - Created fresh every time `resolve()` is called
   * - Never cached or shared
   * - Garbage collected when references dropped
   * - Highest memory usage, lowest isolation risk
   *
   * **Use Cases:**
   * - Command handlers (isolated execution)
   * - Query handlers
   * - Validators and mappers
   * - Short-lived operations
   *
   * **Performance Consideration:**
   *
   * Transient has highest overhead due to repeated allocations:
   *
   * ```typescript
   * // Creates 1000 instances!
   * for (let i = 0; i < 1000; i++) {
   *   const handler = container.resolve(MyHandler);
   *   await handler.execute(commands[i]);
   * }
   *
   * // Better: Resolve once, reuse
   * const handler = container.resolve(MyHandler);
   * for (const cmd of commands) {
   *   await handler.execute(cmd);
   * }
   * ```
   *
   * @example
   * ```typescript
   * const IUserRepository = Symbol('IUserRepository');
   * const IEventBus = Symbol('IEventBus');
   *
   * class CreateUserHandler {
   *   static inject = [IUserRepository, IEventBus] as const;
   *
   *   constructor(
   *     private repo: IUserRepository,
   *     private eventBus: IEventBus
   *   ) {}
   *
   *   async execute(command: CreateUserCommand): Promise<User> {
   *     const user = new User(command.email);
   *     await this.repo.save(user);
   *     await this.eventBus.publish(new UserCreatedEvent(user));
   *     return user;
   *   }
   * }
   *
   * container.addTransient(CreateUserHandler);
   * ```
   */
  Transient = 'transient',
}

/**
 * Check if a lifetime allows caching.
 *
 * @param lifetime - The lifetime to check
 * @returns True if instances should be cached
 *
 * @internal
 */
export function isCacheable(lifetime: ServiceLifetime): boolean {
  return lifetime === ServiceLifetime.Singleton || lifetime === ServiceLifetime.Scoped;
}

/**
 * Get the priority of a lifetime (for dependency validation).
 *
 * @param lifetime - The lifetime to check
 * @returns Priority number (higher = shorter lifetime)
 *
 * @remarks
 * Lower priority lifetimes CANNOT depend on higher priority:
 * - Singleton (0) cannot depend on Scoped (1) or Transient (2)
 * - Scoped (1) cannot depend on Transient (2)
 *
 * @internal
 */
export function getLifetimePriority(lifetime: ServiceLifetime): number {
  switch (lifetime) {
    case ServiceLifetime.Singleton:
      return 0;
    case ServiceLifetime.Scoped:
      return 1;
    case ServiceLifetime.Transient:
      return 2;
    default:
      return 999;
  }
}

/**
 * Check if a service with `from` lifetime can depend on a service with `to` lifetime.
 *
 * @param from - Lifetime of the dependent service
 * @param to - Lifetime of the dependency
 * @returns True if the dependency is valid
 *
 * @example
 * ```typescript
 * canDependOn(ServiceLifetime.Singleton, ServiceLifetime.Singleton); // true
 * canDependOn(ServiceLifetime.Singleton, ServiceLifetime.Scoped); // false!
 * canDependOn(ServiceLifetime.Scoped, ServiceLifetime.Singleton); // true
 * canDependOn(ServiceLifetime.Scoped, ServiceLifetime.Scoped); // true
 * canDependOn(ServiceLifetime.Transient, ServiceLifetime.Scoped); // true
 * ```
 */
export function canDependOn(from: ServiceLifetime, to: ServiceLifetime): boolean {
  const fromPriority = getLifetimePriority(from);
  const toPriority = getLifetimePriority(to);

  // Lower priority (longer lived) cannot depend on higher priority (shorter lived)
  return fromPriority >= toPriority;
}

/**
 * Get a human-readable name for a lifetime.
 *
 * @param lifetime - The lifetime
 * @returns Human-readable string
 */
export function getLifetimeName(lifetime: ServiceLifetime): string {
  switch (lifetime) {
    case ServiceLifetime.Singleton:
      return 'Singleton';
    case ServiceLifetime.Scoped:
      return 'Scoped';
    case ServiceLifetime.Transient:
      return 'Transient';
    default:
      return 'Unknown';
  }
}

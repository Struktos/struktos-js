/**
 * @fileoverview AutoContextBehavior - CQRS Pipeline Context Integration
 *
 * @packageDocumentation
 * @module @struktos/core/application/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: APPLICATION
 *
 * This module provides the conceptual interface and example implementation
 * for integrating context propagation with the CQRS (Command/Query) pipeline.
 *
 * ## CQRS Pipeline Architecture
 *
 * ```
 * ┌─────────────┐
 * │   Command   │  (or Query)
 * └──────┬──────┘
 *        │
 *        ▼
 * ┌─────────────────────────────────────────────────────────┐
 * │                   Pipeline Behaviors                     │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
 * │  │ AutoContext │→ │  Logging    │→ │  Transaction    │  │
 * │  │  Behavior   │  │  Behavior   │  │   Behavior      │  │
 * │  └─────────────┘  └─────────────┘  └─────────────────┘  │
 * └─────────────────────────────────────────────────────────┘
 *        │
 *        ▼
 * ┌─────────────┐
 * │   Handler   │
 * └─────────────┘
 * ```
 *
 * ## Key Concept: RequestContext.run() Integration
 *
 * The AutoContextBehavior wraps each command/query execution in a
 * `RequestContext.run()` scope, ensuring all downstream operations
 * have access to the request context.
 *
 * @version 1.0.0
 */

import { type IContext, type IStruktosContextData } from '../../domain/context';
import { RequestContext } from '../../infrastructure/context';

// ============================================================================
// CQRS Base Types (Conceptual - Full implementation in CQRS module)
// ============================================================================

/**
 * Base interface for CQRS commands.
 *
 * @remarks
 * This is a simplified representation. The full implementation
 * lives in the `@struktos/core/application/cqrs` module.
 */
export interface ICommand {
  /** Unique identifier for this command */
  readonly commandId?: string;

  /** Trace ID for distributed tracing */
  readonly traceId?: string;

  /** User ID who initiated this command */
  readonly userId?: string;
}

/**
 * Base interface for CQRS queries.
 */
export interface IQuery<TResult = unknown> {
  /** Unique identifier for this query */
  readonly queryId?: string;

  /** Trace ID for distributed tracing */
  readonly traceId?: string;

  /** Phantom type for result */
  readonly _resultType?: TResult;
}

/**
 * Handler context passed to command/query handlers.
 */
export interface IHandlerContext<TData extends IStruktosContextData = IStruktosContextData> {
  /** Request context for this execution */
  readonly context: IContext<TData>;

  /** Cancellation signal */
  readonly signal?: AbortSignal;
}

/**
 * Pipeline behavior interface - wraps handler execution.
 *
 * @template TRequest - Command or Query type
 * @template TResponse - Handler response type
 */
export interface IPipelineBehavior<TRequest = unknown, TResponse = unknown> {
  /**
   * Handle the request with access to the next delegate.
   *
   * @param request - The command or query
   * @param next - Function to call the next behavior/handler
   * @param ctx - Handler context
   * @returns Response from the handler
   */
  handle(
    request: TRequest,
    next: () => Promise<TResponse>,
    ctx: IHandlerContext,
  ): Promise<TResponse>;
}

// ============================================================================
// AutoContextBehavior Interface
// ============================================================================

/**
 * Configuration for AutoContextBehavior.
 */
export interface IAutoContextBehaviorOptions<TData extends IStruktosContextData> {
  /**
   * Extract initial context data from a command/query.
   * Default: Extracts traceId and userId if present.
   */
  extractContextData?: (request: unknown) => Partial<TData>;

  /**
   * Generate trace ID if not present in request.
   * Default: Uses crypto.randomUUID()
   */
  generateTraceId?: () => string;

  /**
   * Whether to propagate cancellation from the request.
   * Default: true
   */
  propagateCancellation?: boolean;
}

/**
 * IAutoContextBehavior - Pipeline behavior that creates context scope.
 *
 * @template TData - Context data type
 *
 * @remarks
 * **Purpose:**
 *
 * This behavior ensures every command/query execution has:
 * 1. An active RequestContext scope
 * 2. Proper context data (traceId, userId, etc.)
 * 3. Cancellation propagation
 *
 * **Pipeline Position:**
 *
 * Should be the FIRST behavior in the pipeline so all other
 * behaviors have access to context.
 *
 * @example Registration in CQRS bus
 * ```typescript
 * const commandBus = new CommandBus();
 *
 * // Register behaviors in order
 * commandBus.addBehavior(new AutoContextBehavior());
 * commandBus.addBehavior(new LoggingBehavior());
 * commandBus.addBehavior(new TransactionBehavior());
 * ```
 */
export interface IAutoContextBehavior<
  TData extends IStruktosContextData = IStruktosContextData,
> extends IPipelineBehavior {
  /**
   * Configure behavior options.
   */
  configure(options: IAutoContextBehaviorOptions<TData>): void;
}

// ============================================================================
// AutoContextBehavior Implementation
// ============================================================================

/**
 * Default trace ID generator using crypto.randomUUID.
 */
function defaultGenerateTraceId(): string {
  // Use crypto.randomUUID if available (Node 19+), fallback to Date-based
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Default context data extractor.
 */
function defaultExtractContextData(request: unknown): Partial<IStruktosContextData> {
  if (typeof request !== 'object' || request === null) {
    return {};
  }

  const req = request as Record<string, unknown>;
  const data: Partial<IStruktosContextData> = {};

  if (typeof req['traceId'] === 'string') {
    data.traceId = req['traceId'];
  }
  if (typeof req['userId'] === 'string') {
    data.userId = req['userId'];
  }
  if (typeof req['commandId'] === 'string' || typeof req['queryId'] === 'string') {
    data.requestId = (req['commandId'] ?? req['queryId']) as string;
  }

  return data;
}

/**
 * AutoContextBehavior - Creates RequestContext scope for CQRS operations.
 *
 * @template TData - Context data type
 *
 * @example
 * ```typescript
 * import { AutoContextBehavior } from '@struktos/core/application/context';
 *
 * const behavior = new AutoContextBehavior({
 *   generateTraceId: () => `myapp-${Date.now()}`,
 * });
 *
 * // Usage in pipeline
 * const result = await behavior.handle(
 *   command,
 *   () => handler.execute(command),
 *   { context: RequestContext.current()! }
 * );
 * ```
 */
export class AutoContextBehavior<
  TData extends IStruktosContextData = IStruktosContextData,
> implements IAutoContextBehavior<TData> {
  private options: Required<IAutoContextBehaviorOptions<TData>>;

  constructor(options: IAutoContextBehaviorOptions<TData> = {}) {
    this.options = {
      extractContextData: (options.extractContextData ?? defaultExtractContextData) as (
        request: unknown,
      ) => Partial<TData>,
      generateTraceId: options.generateTraceId ?? defaultGenerateTraceId,
      propagateCancellation: options.propagateCancellation ?? true,
    };
  }

  configure(options: IAutoContextBehaviorOptions<TData>): void {
    this.options = {
      ...this.options,
      ...options,
    } as Required<IAutoContextBehaviorOptions<TData>>;
  }

  /**
   * Handle the request by wrapping it in a RequestContext.run() scope.
   */
  async handle<TRequest, TResponse>(
    request: TRequest,
    next: () => Promise<TResponse>,
    _ctx: IHandlerContext,
  ): Promise<TResponse> {
    // Extract context data from request
    const extractedData = this.options.extractContextData(request);

    const traceId = extractedData['traceId'] ?? this.options.generateTraceId();

    const initialData: TData = {
      ...extractedData,
      traceId,
      timestamp: Date.now(),
    } as TData;

    // Run within context scope
    return RequestContext.run(initialData as TData, async () => {
      const ctx = RequestContext.current<TData>();

      // Propagate cancellation if AbortSignal is provided
      if (this.options.propagateCancellation && _ctx.signal) {
        _ctx.signal.addEventListener('abort', () => {
          ctx?.cancel();
        });
      }

      // Execute next behavior/handler
      return next();
    });
  }
}

// ============================================================================
// Example Usage Documentation
// ============================================================================

/**
 * @example Full CQRS integration
 * ```typescript
 * // 1. Define your command
 * interface CreateUserCommand extends ICommand {
 *   name: string;
 *   email: string;
 * }
 *
 * // 2. Define handler
 * class CreateUserHandler {
 *   async execute(command: CreateUserCommand): Promise<User> {
 *     const ctx = RequestContext.current();
 *
 *     // Context is available!
 *     console.log(`[${ctx?.get(TRACE_ID_KEY)}] Creating user`);
 *
 *     return this.userRepository.create({
 *       name: command.name,
 *       email: command.email,
 *     });
 *   }
 * }
 *
 * // 3. Configure pipeline
 * const commandBus = new CommandBus();
 * commandBus.addBehavior(new AutoContextBehavior());
 * commandBus.registerHandler(CreateUserCommand, CreateUserHandler);
 *
 * // 4. Execute command
 * const command: CreateUserCommand = {
 *   traceId: 'from-http-header',
 *   userId: 'authenticated-user',
 *   name: 'John',
 *   email: 'john@example.com',
 * };
 *
 * const user = await commandBus.execute(command);
 * ```
 *
 * @example Middleware integration (Express)
 * ```typescript
 * // Express middleware that creates context
 * app.use((req, res, next) => {
 *   const initialData = {
 *     traceId: req.headers['x-trace-id'] ?? generateTraceId(),
 *     userId: req.user?.id,
 *     timestamp: Date.now(),
 *   };
 *
 *   RequestContext.run(initialData, () => {
 *     // Cancel context if client disconnects
 *     res.on('close', () => {
 *       if (!res.writableEnded) {
 *         RequestContext.current()?.cancel();
 *       }
 *     });
 *
 *     next();
 *   });
 * });
 *
 * // Handler - context automatically available
 * app.post('/users', async (req, res) => {
 *   const ctx = RequestContext.require();
 *   console.log(`[${ctx.get(TRACE_ID_KEY)}] Creating user`);
 *
 *   // CQRS command execution (context propagates automatically)
 *   const user = await commandBus.execute({
 *     // traceId inherited from context
 *     name: req.body.name,
 *     email: req.body.email,
 *   });
 *
 *   res.json(user);
 * });
 * ```
 */
export const USAGE_EXAMPLES = null; // Just for documentation

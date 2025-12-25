/**
 * @fileoverview Application Context Module Exports
 *
 * @packageDocumentation
 * @module @struktos/core/application/context
 * @license Apache-2.0
 *
 * ## Hexagonal Architecture Layer: APPLICATION
 *
 * This module exports CQRS pipeline integration for context propagation.
 * The AutoContextBehavior ensures all command/query executions have
 * proper context scope.
 *
 * ## Usage
 *
 * ```typescript
 * import { AutoContextBehavior } from '@struktos/core/application/context';
 *
 * const commandBus = new CommandBus();
 * commandBus.addBehavior(new AutoContextBehavior());
 * ```
 */

// ============================================================================
// AutoContextBehavior - CQRS Pipeline Integration
// ============================================================================

export {
  AutoContextBehavior,
  type IAutoContextBehavior,
  type IAutoContextBehaviorOptions,
  type ICommand,
  type IQuery,
  type IHandlerContext,
  type IPipelineBehavior,
} from './auto-context.behavior';

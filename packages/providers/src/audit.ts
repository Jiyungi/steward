import { randomUUID } from "node:crypto";

import {
  createToolResultSchema,
  type EventActor,
  type IncidentEvent,
  type ToolResult,
} from "@steward/contracts";
import type { IncidentStore } from "@steward/db";
import { z } from "zod";

export interface ProviderOutcome<T> {
  status: ToolResult["status"];
  data?: T;
  error?: { code: string; safeMessage: string; retryable: boolean };
  evidenceRefs?: string[];
}

export interface AuditedProviderAction<T> {
  incidentId: string;
  operationId: string;
  idempotencyKey?: string;
  provider: ToolResult["provider"];
  operation: string;
  requestSummary?: Record<string, unknown>;
  actor?: EventActor;
  dataSchema: z.ZodType<T>;
  execute(): Promise<ProviderOutcome<T>>;
}

export interface ProviderClock {
  now(): Date;
}

const systemClock: ProviderClock = { now: () => new Date() };

export class ProviderActionAuditor {
  public constructor(
    private readonly store: IncidentStore,
    private readonly clock: ProviderClock = systemClock,
  ) {}

  public async run<T>(action: AuditedProviderAction<T>): Promise<ToolResult<T>> {
    if (action.idempotencyKey !== undefined) {
      const existing = await this.store.getOperationByIdempotencyKey(action.idempotencyKey);
      if (existing?.result !== null && existing?.result !== undefined) {
        return createToolResultSchema(action.dataSchema).parse(existing.result) as ToolResult<T>;
      }
      if (existing !== null) {
        return createToolResultSchema(action.dataSchema).parse({
          version: 1,
          incidentId: action.incidentId,
          operationId: existing.operationId,
          provider: action.provider,
          operation: action.operation,
          status: "unknown",
          startedAt: existing.startedAt,
          completedAt: this.clock.now().toISOString(),
          evidenceRefs: [],
        }) as ToolResult<T>;
      }
    }

    const startedAt = this.clock.now().toISOString();
    await this.store.beginOperation({
      operationId: action.operationId,
      incidentId: action.incidentId,
      provider: action.provider,
      operation: action.operation,
      ...(action.idempotencyKey === undefined ? {} : { idempotencyKey: action.idempotencyKey }),
      ...(action.requestSummary === undefined ? {} : { requestSummary: action.requestSummary }),
      startedAt,
    });

    const actor = action.actor ?? { kind: "system", component: "agent" };
    await this.store.appendEvent(this.toolStartedEvent(action, actor, startedAt));

    let outcome: ProviderOutcome<T>;
    try {
      outcome = await action.execute();
    } catch (error) {
      outcome = {
        status: "failure",
        error: {
          code: "PROVIDER_UNAVAILABLE",
          safeMessage: "The provider request failed before a confirmed result was returned.",
          retryable: true,
        },
      };
      void error;
    }

    const completedAt = this.clock.now().toISOString();
    const result = createToolResultSchema(action.dataSchema).parse({
      version: 1,
      incidentId: action.incidentId,
      operationId: action.operationId,
      provider: action.provider,
      operation: action.operation,
      status: outcome.status,
      startedAt,
      completedAt,
      ...(outcome.data === undefined ? {} : { data: outcome.data }),
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
      evidenceRefs: outcome.evidenceRefs ?? [],
    }) as ToolResult<T>;

    await this.store.completeOperation(action.operationId, result);
    await this.store.appendEvent(this.toolCompletedEvent(result, actor, completedAt));
    return result;
  }

  private toolStartedEvent<T>(action: AuditedProviderAction<T>, actor: EventActor, occurredAt: string): IncidentEvent {
    return {
      version: 1,
      incidentId: action.incidentId,
      eventId: `evt-${randomUUID()}`,
      occurredAt,
      actor,
      type: "tool.started",
      payload: { operationId: action.operationId, provider: action.provider, operation: action.operation },
    };
  }

  private toolCompletedEvent(result: ToolResult, actor: EventActor, occurredAt: string): IncidentEvent {
    return {
      version: 1,
      incidentId: result.incidentId,
      eventId: `evt-${randomUUID()}`,
      occurredAt,
      actor,
      type: "tool.completed",
      payload: { result },
    };
  }
}

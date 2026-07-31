import {
  getActiveTraceId,
  propagateAttributes,
  startActiveObservation,
} from "@langfuse/tracing";

import { errorForTelemetry, redactForTelemetry } from "./redaction.js";

export interface IncidentTraceContext {
  correlationId: string;
  incidentId: string;
  sessionId: string;
  userId?: string;
  channel: "phone" | "web" | "vendor-call" | "smoke";
  feature: string;
  tags?: string[];
  version?: string;
}

export interface TracedResult<T> {
  traceId: string;
  value: T;
}

export async function withIncidentTrace<T>(options: {
  context: IncidentTraceContext;
  input: unknown;
  run: () => Promise<T>;
  summarizeOutput?: (value: T) => unknown;
}): Promise<TracedResult<T>> {
  return startActiveObservation(
    "resolve-incident-turn",
    async (observation) => {
      return propagateAttributes(
        {
          ...(options.context.userId ? { userId: options.context.userId } : {}),
          sessionId: options.context.sessionId,
          traceName: "resolve-incident-turn",
          tags: [
            "steward",
            options.context.channel,
            options.context.feature,
            ...(options.context.tags ?? []),
          ],
          metadata: {
            correlationId: options.context.correlationId,
            incidentId: options.context.incidentId,
            channel: options.context.channel,
            feature: options.context.feature,
          },
          ...(options.context.version ? { version: options.context.version } : {}),
        },
        async () => {
          const traceId = getActiveTraceId();

          if (!traceId) {
            throw new Error("Langfuse trace context was not initialized");
          }

          observation.update({
            input: redactForTelemetry(options.input),
            metadata: { correlationId: options.context.correlationId },
          });

          try {
            const value = await options.run();
            observation.update({
              output: redactForTelemetry(
                options.summarizeOutput
                  ? options.summarizeOutput(value)
                  : value,
              ),
            });
            return { traceId, value };
          } catch (error) {
            observation.update({
              level: "ERROR",
              output: {
                status: "failure",
                error: errorForTelemetry(error),
              },
            });
            throw error;
          }
        },
      );
    },
    { asType: "agent" },
  );
}

export async function traceToolCall<T>(options: {
  name: string;
  input: unknown;
  run: () => Promise<T>;
  summarizeOutput?: (value: T) => unknown;
}): Promise<T> {
  return startActiveObservation(
    options.name,
    async (observation) => {
      const startedAt = performance.now();
      observation.update({ input: redactForTelemetry(options.input) });

      try {
        const value = await options.run();
        observation.update({
          output: redactForTelemetry(
            options.summarizeOutput
              ? options.summarizeOutput(value)
              : value,
          ),
          metadata: {
            durationMs: Math.round(performance.now() - startedAt),
            outcome: "success",
          },
        });
        return value;
      } catch (error) {
        observation.update({
          level: "ERROR",
          output: {
            status: "failure",
            error: errorForTelemetry(error),
          },
          metadata: {
            durationMs: Math.round(performance.now() - startedAt),
            outcome: "failure",
          },
        });
        throw error;
      }
    },
    { asType: "tool" },
  );
}

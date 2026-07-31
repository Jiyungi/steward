import { randomUUID } from "node:crypto";

import type { AgentRuntimeConfig } from "@steward/config";
import { traceToolCall, withIncidentTrace } from "@steward/observability";

import { createReasoningClient } from "./reasoning-client.js";

export async function runTraceSmoke(config: AgentRuntimeConfig): Promise<{
  traceId: string;
  responseId: string;
}> {
  const correlationId = randomUUID();
  const client = createReasoningClient(config);

  const traced = await withIncidentTrace({
    context: {
      correlationId,
      incidentId: `smoke-${correlationId}`,
      sessionId: `smoke-${correlationId}`,
      userId: "system-smoke",
      channel: "smoke",
      feature: "observability-preflight",
      tags: ["preflight"],
      ...(config.LANGFUSE_RELEASE
        ? { version: config.LANGFUSE_RELEASE }
        : {}),
    },
    input: {
      purpose: "Verify traced a1 Responses connectivity",
      model: config.OPENAI_MODEL,
    },
    run: async () => {
      await traceToolCall({
        name: "validate-runtime-config",
        input: {
          providers: ["a1mobile", "langfuse"],
          checks: ["model", "base-url", "telemetry-environment"],
        },
        run: async () => ({
          status: "success" as const,
          modelConfigured: Boolean(config.OPENAI_MODEL),
          telemetryEnvironment: config.LANGFUSE_TRACING_ENVIRONMENT,
        }),
      });

      const response = await client.responses.create({
        model: config.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are the Steward observability preflight. Follow the requested output exactly.",
          },
          {
            role: "user",
            content: "Reply with exactly: Steward tracing online.",
          },
        ],
        max_output_tokens: 32,
      });

      return {
        responseId: response.id,
        model: response.model,
        output: response.output_text.trim(),
      };
    },
    summarizeOutput: (result) => ({
      status: "success",
      responseId: result.responseId,
      model: result.model,
      assistantResponse: result.output,
    }),
  });

  return {
    traceId: traced.traceId,
    responseId: traced.value.responseId,
  };
}

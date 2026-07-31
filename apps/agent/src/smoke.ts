import { randomUUID } from "node:crypto";

import type { AgentRuntimeConfig } from "@steward/config";
import { traceToolCall, withIncidentTrace } from "@steward/observability";
import OpenAI from "openai";

import { createReasoningClient } from "./reasoning-client.js";

export async function runTraceSmoke(config: AgentRuntimeConfig): Promise<{
  traceId: string;
  responseId: string;
  streamingResponseId: string | null;
  streamingSupported: boolean;
  toolResponseId: string;
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

      let streamingResponseId: string | null = null;
      let streamingText = "";
      let streamingSupported = true;
      try {
        const stream = await client.responses.create({
          model: config.OPENAI_MODEL,
          input: "Reply with exactly: Steward stream online.",
          max_output_tokens: 32,
          stream: true,
        });
        for await (const event of stream) {
          if (event.type === "response.created") streamingResponseId = event.response.id;
          if (event.type === "response.output_text.delta") streamingText += event.delta;
          if (event.type === "response.completed") streamingResponseId ??= event.response.id;
        }
        if (streamingResponseId === null || !streamingText.trim()) {
          throw new Error("The a1 Responses streaming capability gate returned no usable output.");
        }
      } catch (error) {
        if (error instanceof OpenAI.APIError && error.status === 400 && /stream is not supported/i.test(error.message)) {
          streamingSupported = false;
          streamingResponseId = null;
        } else {
          throw error;
        }
      }

      const toolResponse = await client.responses.create({
        model: config.OPENAI_MODEL,
        input: "Call report_preflight_status with status ready. Do not answer in prose.",
        max_output_tokens: 64,
        tools: [{
          type: "function",
          name: "report_preflight_status",
          description: "Report the harmless runtime preflight status.",
          strict: true,
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: { status: { type: "string", enum: ["ready"] } },
          },
        }],
        tool_choice: { type: "function", name: "report_preflight_status" },
      });
      const toolCall = toolResponse.output.find((item) => item.type === "function_call");
      if (toolCall === undefined || JSON.parse(toolCall.arguments).status !== "ready") {
        throw new Error("The a1 Responses typed-tool capability gate did not return the required call.");
      }

      return {
        responseId: response.id,
        streamingResponseId,
        streamingSupported,
        toolResponseId: toolResponse.id,
        model: response.model,
        output: response.output_text.trim(),
        streamingOutput: streamingSupported ? streamingText.trim() : "unsupported-by-gateway",
      };
    },
    summarizeOutput: (result) => ({
      status: "success",
      responseId: result.responseId,
      streamingResponseId: result.streamingResponseId,
      streamingSupported: result.streamingSupported,
      toolResponseId: result.toolResponseId,
      model: result.model,
      assistantResponse: result.output,
      streamingOutput: result.streamingOutput,
    }),
  });

  return {
    traceId: traced.traceId,
    responseId: traced.value.responseId,
    streamingResponseId: traced.value.streamingResponseId,
    streamingSupported: traced.value.streamingSupported,
    toolResponseId: traced.value.toolResponseId,
  };
}

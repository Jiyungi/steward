import type { APIConnectOptions } from "@livekit/agents";
import {
  APIConnectionError,
  APIStatusError,
  APITimeoutError,
  DEFAULT_API_CONNECT_OPTIONS,
  llm,
  toError,
} from "@livekit/agents";
import type { AgentRuntimeConfig } from "@steward/config";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";

import { createReasoningClient } from "./reasoning-client.js";

interface A1ResponsesOptions {
  client: OpenAI;
  model: string;
  maxOutputTokens: number;
}

function toResponsesTools(toolContext: llm.ToolContext | undefined): OpenAI.Responses.Tool[] | undefined {
  if (toolContext === undefined) return undefined;
  const tools = Object.values(toolContext.functionTools).map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
    strict: false,
  }));
  return tools.length === 0 ? undefined : tools;
}

class A1ResponsesStream extends llm.LLMStream {
  constructor(
    parent: A1ResponsesLLM,
    private readonly options: A1ResponsesOptions,
    stream: {
      chatCtx: llm.ChatContext;
      toolCtx?: llm.ToolContext;
      connOptions: APIConnectOptions;
      extraKwargs?: Record<string, unknown>;
    },
  ) {
    super(parent, stream);
    this.extraKwargs = stream.extraKwargs ?? {};
  }

  private readonly extraKwargs: Record<string, unknown>;

  protected async run(): Promise<void> {
    try {
      const messages = (await this.chatCtx.toProviderFormat(
        "openai.responses",
      )) as OpenAI.Responses.ResponseInputItem[];
      const tools = toResponsesTools(this.toolCtx);
      const response = await this.options.client.responses.create(
        {
          model: this.options.model,
          input: messages,
          ...(tools === undefined ? {} : { tools }),
          max_output_tokens: this.options.maxOutputTokens,
          ...this.extraKwargs,
        },
        { timeout: this.connOptions.timeoutMs, signal: this.abortController.signal },
      );

      for (const item of response.output) {
        if (item.type !== "function_call") continue;
        this.queue.put({
          id: response.id,
          delta: {
            role: "assistant",
            toolCalls: [llm.FunctionCall.create({
              callId: item.call_id || item.id || `call-${randomUUID()}`,
              name: item.name,
              args: item.arguments,
            })],
          },
        });
      }
      const text = response.output_text.trim();
      if (text) {
        this.queue.put({
          id: response.id,
          delta: { role: "assistant", content: text },
        });
      }
      if (response.usage) {
        this.queue.put({
          id: response.id,
          usage: {
            completionTokens: response.usage.output_tokens,
            promptTokens: response.usage.input_tokens,
            promptCachedTokens: response.usage.input_tokens_details.cached_tokens,
            totalTokens: response.usage.total_tokens,
            ...(response.service_tier == null ? {} : { serviceTier: response.service_tier }),
          },
        });
      }
    } catch (error) {
      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new APITimeoutError({ options: { retryable: true } });
      }
      if (error instanceof OpenAI.APIError) {
        throw new APIStatusError({
          message: error.message,
          options: {
            statusCode: error.status,
            body: error.error,
            ...(error.requestID === undefined ? {} : { requestId: error.requestID }),
            retryable: error.status === undefined || error.status === 408 || error.status === 429 || error.status >= 500,
          },
        });
      }
      throw new APIConnectionError({ message: toError(error).message, options: { retryable: true } });
    }
  }
}

export class A1ResponsesLLM extends llm.LLM {
  readonly #options: A1ResponsesOptions;

  constructor(config: AgentRuntimeConfig) {
    super();
    this.#options = {
      client: createReasoningClient(config),
      model: config.OPENAI_MODEL,
      maxOutputTokens: 192,
    };
  }

  override label(): string {
    return "a1.responses.non-streaming-compat";
  }

  override get model(): string {
    return this.#options.model;
  }

  override get provider(): string {
    return "a1mobile";
  }

  override chat(input: {
    chatCtx: llm.ChatContext;
    toolCtx?: llm.ToolContextLike;
    connOptions?: APIConnectOptions;
    parallelToolCalls?: boolean;
    toolChoice?: llm.ToolChoice;
    extraKwargs?: Record<string, unknown>;
  }): llm.LLMStream {
    const toolContext = llm.toToolContext(input.toolCtx);
    const extraKwargs = {
      ...(input.extraKwargs ?? {}),
      ...(input.toolChoice === undefined ? {} : { tool_choice: input.toolChoice }),
    };
    return new A1ResponsesStream(this, {
      ...this.#options,
    }, {
      chatCtx: input.chatCtx,
      ...(toolContext === undefined ? {} : { toolCtx: toolContext }),
      connOptions: input.connOptions ?? DEFAULT_API_CONNECT_OPTIONS,
      extraKwargs,
    });
  }
}

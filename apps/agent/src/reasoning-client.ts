import { observeOpenAI } from "@langfuse/openai";
import type { AgentRuntimeConfig } from "@steward/config";
import OpenAI from "openai";

export function createReasoningClient(config: AgentRuntimeConfig): OpenAI {
  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
  });

  return observeOpenAI(client, {
    generationName: "generate-incident-response",
    generationMetadata: {
      provider: "a1mobile",
      api: "responses",
      purpose: "incident-reasoning",
    },
  });
}

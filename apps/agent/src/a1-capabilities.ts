import type { AgentRuntimeConfig } from "@steward/config";
import OpenAI from "openai";

import { createReasoningClient } from "./reasoning-client.js";

export interface A1RuntimeCapabilities {
  visionInput: boolean;
}

// A valid one-pixel PNG is enough to test transport support. It is not used to
// infer any incident, object, or expected diagnosis.
const capabilityProbeImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

let cachedProbe: Promise<A1RuntimeCapabilities> | undefined;

export function probeA1RuntimeCapabilities(config: AgentRuntimeConfig): Promise<A1RuntimeCapabilities> {
  cachedProbe ??= probe(config);
  return cachedProbe;
}

async function probe(config: AgentRuntimeConfig): Promise<A1RuntimeCapabilities> {
  const client = createReasoningClient(config);
  try {
    const response = await client.responses.create({
      model: config.OPENAI_MODEL,
      max_output_tokens: 24,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "State only whether an image was received. Do not diagnose anything." },
          { type: "input_image", image_url: capabilityProbeImage, detail: "low" },
        ],
      }],
    });
    return { visionInput: response.output_text.trim().length > 0 };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.warn("a1_vision_capability_unavailable", { status: error.status ?? "unknown" });
    } else {
      console.warn("a1_vision_capability_unavailable", { status: "connection-error" });
    }
    return { visionInput: false };
  }
}

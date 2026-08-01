import { config as loadDotenv } from "dotenv";
import { readFile } from "node:fs/promises";

loadDotenv({ path: new URL("../../../.env", import.meta.url), quiet: true });
process.env["OTEL_NODE_RESOURCE_DETECTORS"] ??= "env,serviceinstance";
process.env["OTEL_SERVICE_NAME"] ??= "steward-agent-preflight";

const [{ loadAgentRuntimeConfig }, { initializeObservability }] =
  await Promise.all([
    import("@steward/config"),
    import("@steward/observability"),
  ]);

const config = loadAgentRuntimeConfig();
const observability = initializeObservability();

try {
  const [agents, deepgram] = await Promise.all([
    import("@livekit/agents"),
    import("@livekit/agents-plugin-deepgram"),
  ]);
  agents.initializeLogger({ pretty: true, level: "info" });

  const stt = new deepgram.STTv2({
    apiKey: config.DEEPGRAM_API_KEY,
    model: config.DEEPGRAM_STT_MODEL,
    eagerEotThreshold: 0.4,
  });
  const tts = new deepgram.TTS({
    apiKey: config.DEEPGRAM_API_KEY,
    model: config.DEEPGRAM_TTS_MODEL,
    speed: config.DEEPGRAM_TTS_SPEED,
  });
  const runtimeLlm = new agents.inference.LLM({
    model: config.VOICE_LLM_MODEL,
    modelOptions: {
      temperature: 0.2,
      max_completion_tokens: 128,
    },
  });
  const startedAt = performance.now();
  const runtimeResponse = await runtimeLlm.chat({
    chatCtx: new agents.llm.ChatContext([
      agents.llm.ChatMessage.create({
        role: "user",
        content: ["Reply with exactly: Steward runtime online."],
      }),
    ]),
  }).collect();
  const latencyMs = Math.round(performance.now() - startedAt);
  if (!runtimeResponse.text.trim()) {
    throw new Error("The LiveKit streaming inference model returned no text.");
  }
  const healthTool = agents.llm.tool({
    name: "report_runtime_health",
    description: "Report the requested harmless runtime health word.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["online"] },
      },
    },
    execute: async () => ({ accepted: true }),
  });
  const toolStartedAt = performance.now();
  const toolResponse = await runtimeLlm.chat({
    chatCtx: new agents.llm.ChatContext([
      agents.llm.ChatMessage.create({
        role: "user",
        content: ["Use the health tool to report online."],
      }),
    ]),
    toolCtx: [healthTool],
    toolChoice: {
      type: "function",
      function: { name: "report_runtime_health" },
    },
  }).collect();
  const toolLatencyMs = Math.round(performance.now() - toolStartedAt);
  if (toolResponse.toolCalls[0]?.name !== "report_runtime_health") {
    throw new Error("The LiveKit streaming inference model did not return the required tool call.");
  }
  const visualHelpTool = agents.llm.tool({
    name: "request_visual_help",
    description: "Request optional camera evidence when a current view would materially answer an open diagnostic question.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["question", "explanation"],
      properties: {
        question: { type: "string" },
        explanation: { type: "string" },
      },
    },
    execute: async () => ({ status: "pending" }),
  });
  const visionRequestStartedAt = performance.now();
  const visionRequestResponse = await runtimeLlm.chat({
    chatCtx: new agents.llm.ChatContext([
      agents.llm.ChatMessage.create({
        role: "system",
        content: ["When the guest explicitly offers a useful live view of a property issue, call the request_visual_help tool. Do not merely ask verbally."],
      }),
      agents.llm.ChatMessage.create({
        role: "user",
        content: ["The heater is not working, and I can show you what its control panel looks like."],
      }),
    ]),
    toolCtx: [visualHelpTool],
    toolChoice: "auto",
  }).collect();
  const visionRequestLatencyMs = Math.round(performance.now() - visionRequestStartedAt);
  if (visionRequestResponse.toolCalls[0]?.name !== "request_visual_help") {
    throw new Error(`The selected streaming model did not request visual help; it returned: ${visionRequestResponse.text.slice(0, 160)}`);
  }
  const sampleImage = await readFile(new URL("../../web/app/opengraph-image.png", import.meta.url));
  const imageUrl = `data:image/png;base64,${sampleImage.toString("base64")}`;
  const visionStartedAt = performance.now();
  const visionResponse = await runtimeLlm.chat({
    chatCtx: new agents.llm.ChatContext([
      new agents.llm.ChatMessage({
        role: "user",
        content: [
          "Describe only what is visibly present in this image in one short sentence. Do not infer hidden objects or defects.",
          agents.llm.createImageContent({ image: imageUrl, inferenceDetail: "low", mimeType: "image/png" }),
        ],
      }),
    ]),
  }).collect();
  const visionLatencyMs = Math.round(performance.now() - visionStartedAt);
  if (!visionResponse.text.trim()) {
    throw new Error("The selected streaming inference model did not return an image observation.");
  }
  await observability.forceFlush();

  console.log("Steward agent preflight passed", {
    response: runtimeResponse.text.trim(),
    latencyMs,
    toolLatencyMs,
    toolName: toolResponse.toolCalls[0].name,
    visionRequestLatencyMs,
    visionLatencyMs,
    visionObservation: visionResponse.text.trim(),
    stt: stt.label,
    tts: tts.label,
    reasoningProvider: "livekit-inference",
    reasoningModel: config.VOICE_LLM_MODEL,
    runtimeAdapter: runtimeLlm.label(),
  });
} finally {
  await observability.shutdown();
}

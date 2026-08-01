import { config as loadDotenv } from "dotenv";

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
      max_completion_tokens: 32,
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
  await observability.forceFlush();

  console.log("Steward agent preflight passed", {
    response: runtimeResponse.text.trim(),
    latencyMs,
    toolLatencyMs,
    toolName: toolResponse.toolCalls[0].name,
    stt: stt.label,
    tts: tts.label,
    reasoningProvider: "livekit-inference",
    reasoningModel: config.VOICE_LLM_MODEL,
    runtimeAdapter: runtimeLlm.label(),
  });
} finally {
  await observability.shutdown();
}

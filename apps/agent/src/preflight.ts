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
  const [agents, deepgram, { runTraceSmoke }, { A1ResponsesLLM }] = await Promise.all([
    import("@livekit/agents"),
    import("@livekit/agents-plugin-deepgram"),
    import("./smoke.js"),
    import("./a1-responses-llm.js"),
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
  const runtimeLlm = new A1ResponsesLLM(config);
  const runtimeResponse = await runtimeLlm.chat({
    chatCtx: new agents.llm.ChatContext([
      agents.llm.ChatMessage.create({
        role: "user",
        content: ["Reply with exactly: Steward runtime online."],
      }),
    ]),
  }).collect();
  if (!runtimeResponse.text.trim()) throw new Error("The a1 LiveKit compatibility adapter returned no text.");
  const smoke = await runTraceSmoke(config);
  await runtimeLlm.aclose();
  await observability.forceFlush();

  console.log("Steward agent preflight passed", {
    responseId: smoke.responseId,
    streamingResponseId: smoke.streamingResponseId,
    streamingSupported: smoke.streamingSupported,
    toolResponseId: smoke.toolResponseId,
    traceId: smoke.traceId,
    stt: stt.label,
    tts: tts.label,
    reasoningProvider: "a1mobile-responses",
    runtimeAdapter: runtimeLlm.label(),
  });
} finally {
  await observability.shutdown();
}

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
  const [agents, deepgram, openai, { runTraceSmoke }] = await Promise.all([
    import("@livekit/agents"),
    import("@livekit/agents-plugin-deepgram"),
    import("@livekit/agents-plugin-openai"),
    import("./smoke.js"),
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
  const llm = new openai.responses.LLM({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
    model: config.OPENAI_MODEL,
    useWebSocket: false,
    store: false,
    parallelToolCalls: false,
    strictToolSchema: false,
    maxOutputTokens: 256,
  });

  llm.prewarm();
  const smoke = await runTraceSmoke(config);
  await llm.close();
  await observability.forceFlush();

  console.log("Steward agent preflight passed", {
    responseId: smoke.responseId,
    traceId: smoke.traceId,
    stt: stt.label,
    tts: tts.label,
    reasoningProvider: "a1mobile-responses",
  });
} finally {
  await observability.shutdown();
}

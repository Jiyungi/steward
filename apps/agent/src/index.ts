import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const environmentPath = new URL("../../../.env", import.meta.url);
loadDotenv({ path: environmentPath, quiet: true });
process.env["OTEL_NODE_RESOURCE_DETECTORS"] ??= "env,serviceinstance";
process.env["OTEL_SERVICE_NAME"] ??= "steward-agent";

// Langfuse must own the OpenTelemetry provider before LiveKit or the model
// plugins are imported. This module is also imported inside LiveKit's worker
// process, so the order is intentional.
const [{ loadAgentRuntimeConfig }, { initializeObservability }] =
  await Promise.all([
    import("@steward/config"),
    import("@steward/observability"),
  ]);

const runtimeConfig = loadAgentRuntimeConfig();
const observability = initializeObservability();
const [{ cli, ServerOptions }, { default: stewardWorker }] = await Promise.all([
  import("@livekit/agents"),
  import("./worker.js"),
]);

export default stewardWorker;

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const shutdown = async (): Promise<void> => {
    await observability.forceFlush();
  };

  process.once("beforeExit", () => {
    void shutdown();
  });

  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: runtimeConfig.LIVEKIT_AGENT_NAME,
      wsURL: runtimeConfig.LIVEKIT_URL,
      apiKey: runtimeConfig.LIVEKIT_API_KEY,
      apiSecret: runtimeConfig.LIVEKIT_API_SECRET,
      numIdleProcesses: 1,
    }),
  );
}

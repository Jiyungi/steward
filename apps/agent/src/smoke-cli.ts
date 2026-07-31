import { config as loadDotenv } from "dotenv";

const environmentPath = new URL("../../../.env", import.meta.url);
const environmentResult = loadDotenv({ path: environmentPath, quiet: true });
process.env["OTEL_NODE_RESOURCE_DETECTORS"] ??= "env,serviceinstance";
process.env["OTEL_SERVICE_NAME"] ??= "steward-agent-smoke";

if (environmentResult.error) {
  throw new Error("Unable to load the repository-root .env file", {
    cause: environmentResult.error,
  });
}

async function main(): Promise<void> {
  const [{ loadAgentRuntimeConfig }, { initializeObservability }] =
    await Promise.all([
      import("@steward/config"),
      import("@steward/observability"),
    ]);

  const config = loadAgentRuntimeConfig();
  const observability = initializeObservability();

  try {
    const { runTraceSmoke } = await import("./smoke.js");
    const result = await runTraceSmoke(config);
    await observability.forceFlush();

    console.log(`Langfuse trace sent: ${result.traceId}`);
    console.log(`a1 Responses request completed: ${result.responseId}`);
    console.log(`a1 streaming supported: ${result.streamingSupported}`);
    if (result.streamingResponseId !== null) {
      console.log(`a1 streaming gate completed: ${result.streamingResponseId}`);
    }
    console.log(`a1 typed-tool gate completed: ${result.toolResponseId}`);
  } finally {
    await observability.shutdown();
  }
}

await main();

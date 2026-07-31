import { config as loadDotenv } from "dotenv";

const environmentPath = new URL("../../../.env", import.meta.url);
const environmentResult = loadDotenv({ path: environmentPath, quiet: true });

if (environmentResult.error) {
  throw new Error("Unable to load the repository-root .env file", {
    cause: environmentResult.error,
  });
}

async function main(): Promise<void> {
  // Langfuse must initialize after dotenv and before the OpenAI client is imported.
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
  } finally {
    await observability.shutdown();
  }
}

await main();

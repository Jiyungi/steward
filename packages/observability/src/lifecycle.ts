import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { maskLangfuseData } from "./redaction.js";

export interface ObservabilityLifecycle {
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

let activeLifecycle: ObservabilityLifecycle | undefined;

export function initializeObservability(): ObservabilityLifecycle {
  if (activeLifecycle) {
    return activeLifecycle;
  }

  const processor = new LangfuseSpanProcessor({
    mask: maskLangfuseData,
    mediaUploadEnabled: false,
    exportMode:
      process.env["NODE_ENV"] === "production" ? "batched" : "immediate",
  });
  const sdk = new NodeSDK({ spanProcessors: [processor] });

  sdk.start();

  let stopped = false;
  activeLifecycle = {
    async forceFlush() {
      if (!stopped) {
        await processor.forceFlush();
      }
    },
    async shutdown() {
      if (!stopped) {
        stopped = true;
        await sdk.shutdown();
        activeLifecycle = undefined;
      }
    },
  };

  return activeLifecycle;
}

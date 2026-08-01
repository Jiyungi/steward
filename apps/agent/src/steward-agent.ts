import {
  StopResponse,
  type ChatContext,
  type ImageContent,
  type ChatMessage,
  llm,
  voice,
} from "@livekit/agents";

import type { ContractEventPublisher } from "./events.js";
import { buildStewardInstructions } from "./prompt.js";
import { buildScopeRedirect, evaluateScope } from "./scope-policy.js";
import { createVisionRequestTool, type VisionCoordinator } from "./vision.js";

export class StewardAgent extends voice.Agent {
  #activeGoal: string | undefined;
  readonly #audience: "guest" | "vendor";
  readonly #captureVisualForTurn: ((transcript: string) => Promise<ImageContent | null>) | undefined;

  constructor(
    private readonly events: ContractEventPublisher,
    vision: VisionCoordinator,
    initialGoal?: string,
    actionTools: llm.FunctionTool[] = [],
    options: {
      enableVision?: boolean;
      audience?: "guest" | "vendor";
      captureVisualForTurn?: (transcript: string) => Promise<ImageContent | null>;
    } = {},
  ) {
    const audience = options.audience ?? "guest";
    super({
      instructions: buildStewardInstructions(
        initialGoal ? { incidentGoal: initialGoal, audience } : { audience },
      ),
      tools: [
        ...(options.enableVision === false ? [] : [createVisionRequestTool(vision)]),
        ...actionTools,
      ],
    });
    this.#activeGoal = initialGoal;
    this.#audience = audience;
    this.#captureVisualForTurn = options.captureVisualForTurn;
  }

  override async onUserTurnCompleted(
    chatContext: ChatContext,
    newMessage: ChatMessage,
  ): Promise<void> {
    const transcript = newMessage.textContent?.trim();
    if (!transcript) return;

    let removedStaleImage = false;
    for (const item of chatContext.items) {
      if (item.type !== "message") continue;
      const filtered = item.content.filter((content) =>
        typeof content === "string" || content.type !== "image_content"
      );
      if (filtered.length !== item.content.length) removedStaleImage = true;
      item.content = filtered;
    }

    const asksForCurrentView = /\b(look again|look now|what do you see|can you see|do you see|here it is|here's|showing you|camera now|see this|see it now)\b/i.test(transcript);
    if (asksForCurrentView && this.#captureVisualForTurn !== undefined) {
      const freshImage = await this.#captureVisualForTurn(transcript);
      if (freshImage !== null) {
        newMessage.content.push(
          "A fresh camera frame is attached. Describe only this frame; never reuse an earlier visual observation.",
          freshImage,
        );
      } else {
        newMessage.content.push("No fresh camera frame arrived. Do not describe any previous image.");
      }
    } else if (removedStaleImage) {
      newMessage.content.push("No fresh camera frame was requested for this turn. Do not make claims about what the camera currently shows.");
    }

    if (!this.#activeGoal) {
      this.#activeGoal = transcript;
      await this.updateInstructions(
        buildStewardInstructions({ incidentGoal: transcript, audience: this.#audience }),
      );
      return;
    }

    const scope = evaluateScope(transcript, this.#activeGoal);
    if (scope.status !== "off-topic") return;

    await this.events.voice({
      version: 1,
      incidentId: this.events.incidentId,
      state: "speaking",
      safeLabel: "Returning to the active incident",
      occurredAt: new Date().toISOString(),
    });
    this.session.say(buildScopeRedirect(scope.reason), {
      allowInterruptions: true,
      addToChatCtx: true,
    });
    throw new StopResponse();
  }
}

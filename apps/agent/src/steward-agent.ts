import {
  StopResponse,
  type ChatContext,
  type ChatMessage,
  voice,
} from "@livekit/agents";

import type { ContractEventPublisher } from "./events.js";
import { buildStewardInstructions } from "./prompt.js";
import { buildScopeRedirect, evaluateScope } from "./scope-policy.js";
import { createVisionRequestTool, type VisionCoordinator } from "./vision.js";

export class StewardAgent extends voice.Agent {
  #activeGoal: string | undefined;

  constructor(
    private readonly events: ContractEventPublisher,
    vision: VisionCoordinator,
    initialGoal?: string,
  ) {
    super({
      instructions: buildStewardInstructions(
        initialGoal ? { incidentGoal: initialGoal } : {},
      ),
      tools: [createVisionRequestTool(vision)],
    });
    this.#activeGoal = initialGoal;
  }

  override async onUserTurnCompleted(
    _chatContext: ChatContext,
    newMessage: ChatMessage,
  ): Promise<void> {
    const transcript = newMessage.textContent?.trim();
    if (!transcript) return;

    if (!this.#activeGoal) {
      this.#activeGoal = transcript;
      await this.updateInstructions(
        buildStewardInstructions({ incidentGoal: transcript }),
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
    this.session.say(buildScopeRedirect(), {
      allowInterruptions: true,
      addToChatCtx: true,
    });
    throw new StopResponse();
  }
}

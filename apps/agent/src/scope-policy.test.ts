import { describe, expect, it } from "vitest";

import { evaluateScope } from "./scope-policy.js";

describe("evaluateScope", () => {
  const goal = "Help the guest regain safe entry through the front door";

  it.each([
    "Can you give me a pasta recipe?",
    "Tell me facts about donkeys",
    "Write a poem about this city",
  ])("contains an explicit unrelated request: %s", (turn) => {
    expect(evaluateScope(turn, goal).status).toBe("off-topic");
  });

  it.each([
    "Actually, forget the lock.",
    "Ignore this property problem for now",
    "Let's move on from the access issue",
  ])("requires confirmation before abandoning an active incident: %s", (turn) => {
    expect(evaluateScope(turn, goal)).toEqual({
      status: "off-topic",
      reason: "ambiguous-abandonment",
    });
  });

  it.each([
    "The door is still not opening",
    "Okay, I tried that",
    "Can you check a vendor for this issue?",
  ])("keeps incident conversation in scope: %s", (turn) => {
    expect(evaluateScope(turn, goal).status).toBe("relevant");
  });

  it("leaves ambiguous language to the one configured model", () => {
    expect(evaluateScope("Could you explain that?", goal).status).toBe("uncertain");
  });
});

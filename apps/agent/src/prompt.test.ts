import { describe, expect, it } from "vitest";

import { buildInterruptibleGreeting, buildStewardInstructions } from "./prompt.js";

describe("Steward voice prompt", () => {
  it("asks for the issue only when no incident goal was supplied", () => {
    expect(buildInterruptibleGreeting()).toContain("What's going on");
  });

  it("does not ask the guest to repeat a submitted issue", () => {
    const greeting = buildInterruptibleGreeting("the heater is not working");

    expect(greeting).toContain("I have the issue you entered");
    expect(greeting).not.toContain("What's going on");
  });

  it("instructs the model to preserve an established incident goal", () => {
    const instructions = buildStewardInstructions({
      incidentGoal: "the heater is not working",
    });

    expect(instructions).toContain("Goal: the heater is not working");
    expect(instructions).toContain("do not ask the guest to restate it");
  });
});

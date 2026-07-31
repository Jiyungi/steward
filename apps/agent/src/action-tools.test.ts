import { describe, expect, it, vi } from "vitest";

import { createAgentActionTools, type AgentActionService } from "./action-tools.js";
import { HumanSpeechController } from "./speech-controller.js";

function service(): AgentActionService {
  return {
    listApprovedVendors: vi.fn().mockResolvedValue({ source: "approved", vendors: [] }),
    sendApprovedVendorSms: vi.fn().mockResolvedValue({ status: "success" }),
    callApprovedVendor: vi.fn().mockResolvedValue({ status: "success" }),
    recordVendorQuote: vi.fn().mockResolvedValue({ availability: "available" }),
    payLatestQuote: vi.fn().mockResolvedValue({ status: "success", verification: "awaiting-signed-webhook" }),
  };
}

const toolOptions = { toolCallId: "tool-call-1" } as never;

describe("agent action tool gates", () => {
  it("exposes operational tools to the guest agent without exposing quote recording", () => {
    const tools = createAgentActionTools({
      runtime: service(),
      channel: "web",
      speech: new HumanSpeechController(),
      speak: vi.fn(),
    });
    expect(tools.map(({ name }) => name)).toEqual([
      "find_approved_vendors",
      "send_approved_vendor_sms",
      "call_approved_vendor",
      "pay_recorded_vendor_quote",
    ]);
  });

  it("gives an isolated vendor call only the quote recorder", async () => {
    const runtime = service();
    const tools = createAgentActionTools({
      runtime,
      channel: "vendor-call",
      vendorId: "vendor-1",
      speech: new HumanSpeechController(),
      speak: vi.fn(),
    });
    expect(tools.map(({ name }) => name)).toEqual(["record_vendor_quote"]);
    await tools[0]!.execute({ availability: "available", conditions: [] }, toolOptions);
    expect(runtime.recordVendorQuote).toHaveBeenCalledWith("vendor-1", {
      availability: "available",
      conditions: [],
    });
  });

  it("never lets the model choose an arbitrary phone recipient", () => {
    const tools = createAgentActionTools({
      runtime: service(),
      channel: "phone",
      speech: new HumanSpeechController(),
      speak: vi.fn(),
    });
    const schemas = JSON.stringify(tools.map(({ name, parameters }) => ({ name, parameters })));
    expect(schemas).not.toMatch(/phone|e164|recipient/i);
  });
});

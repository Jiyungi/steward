import "server-only";

import { AgentDispatchClient } from "livekit-server-sdk";

import { getServerConfig } from "./config";

function liveKitHttpUrl(url: string): string {
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

export async function ensureAgentDispatch(input: {
  roomName: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const config = getServerConfig();
  const client = new AgentDispatchClient(
    liveKitHttpUrl(config.LIVEKIT_URL),
    config.LIVEKIT_API_KEY,
    config.LIVEKIT_API_SECRET,
  );
  const existing = (await client.listDispatch(input.roomName)).find(
    (dispatch) => dispatch.agentName === config.LIVEKIT_AGENT_NAME,
  );
  if (existing !== undefined) return existing.id;
  const created = await client.createDispatch(input.roomName, config.LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify(input.metadata),
  });
  return created.id;
}

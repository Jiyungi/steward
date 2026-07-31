import "server-only";

import { AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";

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
  const rooms = new RoomServiceClient(
    liveKitHttpUrl(config.LIVEKIT_URL),
    config.LIVEKIT_API_KEY,
    config.LIVEKIT_API_SECRET,
  );
  if ((await rooms.listRooms([input.roomName])).length === 0) {
    await rooms.createRoom({ name: input.roomName, emptyTimeout: 60, departureTimeout: 20 });
  }
  const existing = (await client.listDispatch(input.roomName)).find(
    (dispatch) => dispatch.agentName === config.LIVEKIT_AGENT_NAME,
  );
  if (existing !== undefined) return existing.id;
  const created = await client.createDispatch(input.roomName, config.LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify(input.metadata),
  });
  return created.id;
}

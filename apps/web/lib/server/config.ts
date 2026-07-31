import "server-only";

import { loadPublicWebConfig, loadWebServerConfig } from "@steward/config";

let cachedServerConfig: ReturnType<typeof loadWebServerConfig> | undefined;

export function getServerConfig(): ReturnType<typeof loadWebServerConfig> {
  cachedServerConfig ??= loadWebServerConfig();
  return cachedServerConfig;
}

export function getPublicWebConfig(): ReturnType<typeof loadPublicWebConfig> {
  return loadPublicWebConfig();
}

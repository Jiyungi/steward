import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url), quiet: true });

const command = process.argv[2] ?? "dev";
process.argv.splice(2, 1, command);
await import("next/dist/bin/next");

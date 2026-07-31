import { z } from "zod";

const environmentSchema = z.enum(["development", "test", "production"]);
const nonEmptyString = z.string().trim().min(1);
const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/);
const contractEnvironmentSchema = z
  .string()
  .regex(/^(?!langfuse)[a-z0-9_-]{1,40}$/);

const commonApplicationShape = {
  NODE_ENV: environmentSchema.default("development"),
  APP_BASE_URL: z.url(),
  DEMO_GUEST_ACCESS_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  DEMO_PROPERTY_SLUG: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  GUEST_LINK_EXPIRY_DAYS: z.coerce.number().int().min(1).max(30),
  MAX_PARALLEL_VENDOR_CALLS: z.coerce.number().int().min(1).max(4),
};

const a1Shape = {
  A1MOBILE_BASE_URL: z.url(),
  A1MOBILE_TEAM_KEY: nonEmptyString,
  A1MOBILE_PHONE_NUMBER: e164Schema,
};

const liveKitServerShape = {
  LIVEKIT_URL: z.url().refine((value) => value.startsWith("wss://"), {
    message: "LIVEKIT_URL must use wss://",
  }),
  LIVEKIT_API_KEY: nonEmptyString,
  LIVEKIT_API_SECRET: nonEmptyString,
  LIVEKIT_AGENT_NAME: z.string().trim().min(1).max(100),
  LIVEKIT_SIP_INBOUND_TRUNK_ID: nonEmptyString,
  LIVEKIT_SIP_OUTBOUND_TRUNK_ID: nonEmptyString,
  LIVEKIT_SIP_DISPATCH_RULE_ID: nonEmptyString,
};

const supabaseShape = {
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmptyString,
  SUPABASE_SECRET_KEY: nonEmptyString,
};

const stripeShape = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_test_"),
  STRIPE_SECRET_KEY: z.string().refine(
    (value) => value.startsWith("sk_test_") || value.startsWith("sk_sandbox_"),
    { message: "STRIPE_SECRET_KEY must be a Stripe test or sandbox key" },
  ),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
};

export const agentRuntimeConfigSchema = z.object({
  ...commonApplicationShape,
  ...a1Shape,
  ...liveKitServerShape,
  OPENAI_API_KEY: nonEmptyString,
  OPENAI_BASE_URL: z.url(),
  OPENAI_MODEL: nonEmptyString,
  DEEPGRAM_API_KEY: nonEmptyString,
  DEEPGRAM_STT_MODEL: nonEmptyString,
  DEEPGRAM_TTS_MODEL: nonEmptyString,
  DEEPGRAM_TTS_SPEED: z.coerce.number().min(0.8).max(1.2),
  LANGFUSE_PUBLIC_KEY: nonEmptyString,
  LANGFUSE_SECRET_KEY: nonEmptyString,
  LANGFUSE_BASE_URL: z.url(),
  LANGFUSE_TRACING_ENVIRONMENT: contractEnvironmentSchema,
  LANGFUSE_RELEASE: z.string().min(1).max(200).optional(),
});

export const providerConfigSchema = z.object({
  ...a1Shape,
  A1MOBILE_SIP_USERNAME: nonEmptyString,
  A1MOBILE_SIP_PASSWORD: nonEmptyString,
  ...liveKitServerShape,
  ...stripeShape,
});

export const databaseConfigSchema = z.object({
  ...supabaseShape,
});

export const webServerConfigSchema = z.object({
  ...commonApplicationShape,
  ...a1Shape,
  ...liveKitServerShape,
  ...supabaseShape,
  ...stripeShape,
  NEXT_PUBLIC_LIVEKIT_URL: z.url().refine((value) => value.startsWith("wss://"), {
    message: "NEXT_PUBLIC_LIVEKIT_URL must use wss://",
  }),
});

export const publicWebConfigSchema = z
  .object({
    NEXT_PUBLIC_LIVEKIT_URL: z.url().refine((value) => value.startsWith("wss://")),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmptyString,
    DEMO_GUEST_ACCESS_ENABLED: z.boolean(),
    DEMO_PROPERTY_SLUG: z.string().min(1),
  })
  .strict();

export type AgentRuntimeConfig = z.infer<typeof agentRuntimeConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type WebServerConfig = z.infer<typeof webServerConfigSchema>;
export type PublicWebConfig = z.infer<typeof publicWebConfigSchema>;

const forbiddenPublicSecretNames = [
  "NEXT_PUBLIC_A1MOBILE_TEAM_KEY",
  "NEXT_PUBLIC_DEEPGRAM_API_KEY",
  "NEXT_PUBLIC_LANGFUSE_SECRET_KEY",
  "NEXT_PUBLIC_LIVEKIT_API_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
] as const;

function rejectPublicSecrets(environment: NodeJS.ProcessEnv): void {
  const leaked = forbiddenPublicSecretNames.filter((name) => Boolean(environment[name]));
  if (leaked.length > 0) {
    throw new Error(`Server secrets cannot use NEXT_PUBLIC_ names: ${leaked.join(", ")}`);
  }
}

function parseEnvironment<T>(
  schema: z.ZodType<T>,
  environment: NodeJS.ProcessEnv,
  label: string,
): T {
  rejectPublicSecrets(environment);
  const result = schema.safeParse(environment);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];
    throw new Error(`Invalid ${label} environment configuration: ${fields.join(", ")}`);
  }
  return result.data;
}

export function loadAgentRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AgentRuntimeConfig {
  return parseEnvironment(agentRuntimeConfigSchema, environment, "agent");
}

export function loadProviderConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  return parseEnvironment(providerConfigSchema, environment, "provider");
}

export function loadDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  return parseEnvironment(databaseConfigSchema, environment, "database");
}

export function loadWebServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WebServerConfig {
  return parseEnvironment(webServerConfigSchema, environment, "web server");
}

export function loadPublicWebConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PublicWebConfig {
  const server = loadWebServerConfig(environment);
  return publicWebConfigSchema.parse({
    NEXT_PUBLIC_LIVEKIT_URL: server.NEXT_PUBLIC_LIVEKIT_URL,
    NEXT_PUBLIC_SUPABASE_URL: server.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: server.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DEMO_GUEST_ACCESS_ENABLED: server.DEMO_GUEST_ACCESS_ENABLED,
    DEMO_PROPERTY_SLUG: server.DEMO_PROPERTY_SLUG,
  });
}

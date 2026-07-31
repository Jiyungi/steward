import { z } from "zod";

const agentRuntimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.url(),
  OPENAI_MODEL: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_BASE_URL: z.url(),
  LANGFUSE_TRACING_ENVIRONMENT: z
    .string()
    .regex(/^(?!langfuse)[a-z0-9_-]{1,40}$/),
  LANGFUSE_RELEASE: z.string().min(1).max(200).optional(),
});

export type AgentRuntimeConfig = z.infer<typeof agentRuntimeConfigSchema>;

export function loadAgentRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AgentRuntimeConfig {
  const result = agentRuntimeConfigSchema.safeParse(environment);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");

    throw new Error(`Invalid agent environment configuration: ${fields}`);
  }

  return result.data;
}

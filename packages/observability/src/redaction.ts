const sensitiveKeyPattern =
  /(?:authorization|api[-_]?key|secret|password|token|cookie|session[-_]?token|sip[-_]?username)/i;
const emailKeyPattern = /email/i;
const phoneKeyPattern = /(?:phone|caller|callee|recipient|destination)/i;
const mediaKeyPattern = /(?:audio|image|video|frame|base64|media[-_]?data)/i;

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /(?<!\w)\+?[1-9]\d{7,14}(?!\w)/g;
const cardPattern = /\b(?:\d[ -]*?){13,19}\b/g;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const knownSecretPattern =
  /\b(?:a1hk_[A-Za-z0-9_-]+|sk-(?:lf-)?[A-Za-z0-9_-]+|sk_(?:test|live)_[A-Za-z0-9_-]+|whsec_[A-Za-z0-9_-]+)\b/g;
const dataUrlPattern = /data:(?:image|audio|video)\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const probableBase64Pattern = /\b[A-Za-z0-9+/]{512,}={0,2}\b/g;

const maxTelemetryStringLength = 4_000;

function configuredSecrets(): string[] {
  const names = [
    "A1MOBILE_TEAM_KEY",
    "A1MOBILE_SIP_PASSWORD",
    "DEEPGRAM_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "LANGFUSE_SECRET_KEY",
    "LIVEKIT_API_SECRET",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SUPABASE_SECRET_KEY",
  ];

  return names
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value && value.length >= 6));
}

function redactString(value: string): string {
  let redacted = value;

  for (const secret of configuredSecrets()) {
    redacted = redacted.replaceAll(secret, "[SECRET_REDACTED]");
  }

  redacted = redacted
    .replace(dataUrlPattern, "[MEDIA_OMITTED]")
    .replace(probableBase64Pattern, "[MEDIA_OMITTED]")
    .replace(bearerPattern, "Bearer [SECRET_REDACTED]")
    .replace(knownSecretPattern, "[SECRET_REDACTED]")
    .replace(emailPattern, "[EMAIL_REDACTED]")
    .replace(phonePattern, "[PHONE_REDACTED]")
    .replace(cardPattern, "[PAYMENT_DATA_REDACTED]");

  if (redacted.length <= maxTelemetryStringLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxTelemetryStringLength)}...[TRUNCATED]`;
}

function redactStructured(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactStructured(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }

    seen.add(value);
    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = "[SECRET_REDACTED]";
      } else if (mediaKeyPattern.test(key)) {
        output[key] = "[MEDIA_OMITTED]";
      } else if (emailKeyPattern.test(key)) {
        output[key] = "[EMAIL_REDACTED]";
      } else if (phoneKeyPattern.test(key)) {
        output[key] = "[PHONE_REDACTED]";
      } else {
        output[key] = redactStructured(entry, seen);
      }
    }

    seen.delete(value);
    return output;
  }

  return redactString(String(value));
}

export function redactForTelemetry(value: unknown): unknown {
  return redactStructured(value, new WeakSet<object>());
}

export function maskLangfuseData({ data }: { data: unknown }): unknown {
  if (typeof data !== "string") {
    return redactForTelemetry(data);
  }

  try {
    return JSON.stringify(redactForTelemetry(JSON.parse(data)));
  } catch {
    return redactString(data);
  }
}

export function errorForTelemetry(error: unknown): {
  name: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      name: redactString(error.name),
      message: redactString(error.message),
    };
  }

  return {
    name: "UnknownError",
    message: redactString(String(error)),
  };
}

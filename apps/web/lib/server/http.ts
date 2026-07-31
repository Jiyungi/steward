import "server-only";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new PublicRequestError(400, "invalid_json", "Send a valid JSON request body.");
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PublicRequestError(400, "invalid_request", "Check the submitted fields and try again.");
  }
  return result.data;
}

export class PublicRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof PublicRequestError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  console.error("Steward API failure", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json(
    { error: { code: "internal_error", message: "Steward could not complete that action." } },
    { status: 500 },
  );
}

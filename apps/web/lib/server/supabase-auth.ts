import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerConfig } from "./config";

export async function createSupabaseAuthClient() {
  const cookieStore = await cookies();
  const config = getServerConfig();
  return createServerClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            for (const item of items) cookieStore.set(item.name, item.value, item.options);
          } catch {
            // Server Components cannot write cookies. Route handlers can.
          }
        },
      },
    },
  );
}

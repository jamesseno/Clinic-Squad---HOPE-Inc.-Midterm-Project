"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  createClient as createJsClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}

let authClient: SupabaseClient | undefined;

/**
 * Client used by the one-time invitation/password-setup flow. Explicit
 * implicit-flow options keep the invite session available to getSession().
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (authClient) return authClient;

  const { url, key } = getSupabaseConfig();
  authClient = createJsClient(url, key, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return authClient;
}

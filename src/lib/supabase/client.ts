"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!cached) {
    const { url, anonKey } = supabaseEnv();
    cached = createBrowserClient<Database>(url, anonKey);
  }
  return cached;
}

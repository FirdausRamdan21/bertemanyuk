import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Membuat instance Supabase client untuk digunakan di Client Components.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Salin .env.example ke .env.local lalu isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}

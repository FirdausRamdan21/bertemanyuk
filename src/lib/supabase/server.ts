import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Membuat instance Supabase client untuk Server Components, Server Actions, dan Route Handlers.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Salin .env.example ke .env.local lalu isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Dipanggil dari Server Component read-only; pembaruan cookie ditangani oleh proxy.ts.
        }
      },
    },
  });
}

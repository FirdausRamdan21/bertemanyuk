export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Mengambil konfigurasi environment Supabase dari variabel publik Next.js.
 */
export function getSupabaseEnv(): SupabaseEnv {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  };
}

/**
 * Memastikan kredensial Supabase sudah dikonfigurasi dan bukan placeholder.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    return false;
  }

  if (
    url.includes("your-project-id") ||
    anonKey.includes("your-supabase-anon-key")
  ) {
    return false;
  }

  return url.startsWith("https://") || url.startsWith("http://");
}

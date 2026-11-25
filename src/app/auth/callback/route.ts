import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildFallbackUsername, getSafeNextPath } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    const url = new URL("/login", origin);
    url.searchParams.set(
      "error",
      "Supabase belum dikonfigurasi pada server aplikasi.",
    );
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "Kode otorisasi autentikasi tidak ditemukan.");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const url = new URL("/login", origin);
    url.searchParams.set(
      "error",
      error?.message ?? "Gagal memverifikasi sesi autentikasi.",
    );
    return NextResponse.redirect(url);
  }

  // Pengecekan defensif: pastikan baris profil tersedia jika trigger belum terpasang
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existingProfile) {
    const meta = data.user.user_metadata ?? {};
    const seed =
      (typeof meta.username === "string" && meta.username) ||
      (typeof meta.user_name === "string" && meta.user_name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      data.user.email?.split("@")[0] ||
      "member";

    const avatarUrl =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;

    await supabase.from("profiles").insert({
      id: data.user.id,
      username: buildFallbackUsername(seed, data.user.id),
      avatar_url: avatarUrl,
    });
  }

  return NextResponse.redirect(new URL(next, origin));
}

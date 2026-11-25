"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isValidUsername, normalizeUsername } from "@/lib/validation";

export type AuthActionState = {
  error: string | null;
  needsEmailVerification?: boolean;
  submittedEmail?: string;
};

function translateAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();

  if (lower.includes("rate limit")) {
    return "Batas kirim email bawaan Supabase (2 email/jam) tercapai. Matikan 'Confirm email' di Supabase Dashboard → Authentication → Providers → Email agar bisa daftar & demo tanpa batas email.";
  }

  if (lower.includes("email not confirmed")) {
    return "Email akun ini belum diverifikasi. Matikan 'Confirm email' di Supabase Dashboard atau jalankan UPDATE auth.users SET email_confirmed_at = NOW() di SQL Editor agar langsung bisa masuk.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email atau kata sandi salah. Pastikan akun sudah didaftarkan terlebih dahulu di halaman Daftar.";
  }

  if (lower.includes("user already registered")) {
    return "Email ini sudah terdaftar. Silakan langsung masuk melalui halaman Login.";
  }

  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "Format alamat email tidak valid. Gunakan format seperti nama@domain.com.";
  }

  if (lower.includes("password should be at least")) {
    return "Kata sandi minimal 6 karakter.";
  }

  return rawMessage;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Konfigurasi Supabase belum lengkap. Pastikan .env berisi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Email dan kata sandi wajib diisi.",
      submittedEmail: email,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: translateAuthError(error.message),
      submittedEmail: email,
    };
  }

  if (!data.session) {
    return {
      error:
        "Sesi login tidak terbentuk. Periksa status konfirmasi akun di Supabase Authentication → Users.",
      submittedEmail: email,
    };
  }

  redirect("/chat");
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Konfigurasi Supabase belum lengkap. Pastikan .env berisi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const rawUsername = String(formData.get("username") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const username = normalizeUsername(rawUsername);

  if (!isValidUsername(username)) {
    return {
      error:
        "Username harus 3–24 karakter dan hanya boleh berisi huruf kecil, angka, atau underscore (_).",
      submittedEmail: email,
    };
  }

  if (!email) {
    return {
      error: "Alamat email wajib diisi.",
      submittedEmail: email,
    };
  }

  if (password.length < 6) {
    return {
      error: "Kata sandi minimal 6 karakter.",
      submittedEmail: email,
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "Konfirmasi kata sandi tidak cocok.",
      submittedEmail: email,
    };
  }

  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    (headerStore.get("host") ? `http://${headerStore.get("host")}` : undefined);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
      ...(origin ? { emailRedirectTo: `${origin}/auth/callback` } : {}),
    },
  });

  if (error) {
    return {
      error: translateAuthError(error.message),
      submittedEmail: email,
    };
  }

  if (data.session) {
    redirect("/chat");
  }

  return {
    error: null,
    needsEmailVerification: true,
    submittedEmail: email,
  };
}

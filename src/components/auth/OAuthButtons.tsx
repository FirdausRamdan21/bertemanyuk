"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";

interface OAuthButtonsProps {
  isConfigured: boolean;
  onError?: (message: string) => void;
}

export function OAuthButtons({ isConfigured, onError }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null,
  );

  async function handleOAuthLogin(provider: OAuthProvider) {
    if (!isConfigured || loadingProvider) {
      return;
    }

    onError?.("");
    setLoadingProvider(provider);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes("not enabled") || lower.includes("unsupported provider")) {
          onError?.(
            `Login ${provider === "google" ? "Google" : "GitHub"} belum diaktifkan di Supabase Dashboard (Authentication → Providers). Silakan gunakan Email & Kata Sandi terlebih dahulu.`,
          );
        } else {
          onError?.(error.message);
        }
        setLoadingProvider(null);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memulai autentikasi OAuth.";
      onError?.(message);
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        disabled={!isConfigured || loadingProvider !== null}
        onClick={() => handleOAuthLogin("google")}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-[#2b2d31] px-4 py-2.5 text-sm font-medium text-[#f2f3f5] transition hover:bg-[#35373c] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingProvider === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
            />
            <path
              fill="#34A853"
              d="M3.5 7.4l3.2 2.3C7.6 7.5 9.6 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4c-3.7 0-6.9 2.1-8.5 5z"
            />
            <path
              fill="#FBBC05"
              d="M12 21.6c2.5 0 4.6-.8 6.2-2.2l-2.9-2.4c-.8.5-1.9.9-3.3.9-2.5 0-4.7-1.7-5.4-4l-3.2 2.5c1.6 3.1 4.8 5.2 8.6 5.2z"
            />
            <path
              fill="#4285F4"
              d="M21.1 14.3c.1-.4.1-.8.1-1.3 0-.4 0-.9-.1-1.3H12v3.9h5.4c-.3 1.2-1 2.2-2.1 2.9l2.9 2.4c1.7-1.6 2.9-3.9 2.9-6.6z"
            />
          </svg>
        )}
        <span>Lanjutkan dengan Google</span>
      </button>

      <button
        type="button"
        disabled={!isConfigured || loadingProvider !== null}
        onClick={() => handleOAuthLogin("github")}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-[#2b2d31] px-4 py-2.5 text-sm font-medium text-[#f2f3f5] transition hover:bg-[#35373c] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingProvider === "github" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="h-4 w-4 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.71.12 2.51.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2z" />
          </svg>
        )}
        <span>Lanjutkan dengan GitHub</span>
      </button>

      {!isConfigured && (
        <p className="text-center text-xs text-[#949ba4]">
          Login OAuth aktif setelah variabel Supabase dikonfigurasi.
        </p>
      )}
    </div>
  );
}

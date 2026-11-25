"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { loginAction, type AuthActionState } from "@/app/auth/actions";
import { OAuthButtons } from "./OAuthButtons";
import { SetupNotice } from "./SetupNotice";

interface LoginFormProps {
  isConfigured: boolean;
  initialError?: string;
}

export function LoginForm({ isConfigured, initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<
    AuthActionState,
    FormData
  >(loginAction, { error: initialError ?? null });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState("");

  const displayedError = oauthError || state.error;

  return (
    <div className="space-y-5">
      {!isConfigured && <SetupNotice />}

      {displayedError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-rose-200"
        >
          {displayedError}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={!isConfigured || isPending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Kata Sandi
          </label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={!isConfigured || isPending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="w-full rounded-lg border border-white/10 bg-[#1e1f22] py-2.5 pr-10 pl-3.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword
                  ? "Sembunyikan kata sandi"
                  : "Tampilkan kata sandi"
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[#949ba4] transition hover:text-[#f2f3f5]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isConfigured || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>{isPending ? "Memproses..." : "Masuk"}</span>
        </button>
      </form>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-white/10" />
        <span className="mx-3 shrink-0 text-xs font-medium uppercase text-[#949ba4]">
          atau
        </span>
        <div className="flex-grow border-t border-white/10" />
      </div>

      <OAuthButtons isConfigured={isConfigured} onError={setOauthError} />

      <p className="text-center text-sm text-[#b5bac1]">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-semibold text-[#8ea1e1] hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}

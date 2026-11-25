"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { registerAction, type AuthActionState } from "@/app/auth/actions";
import { OAuthButtons } from "./OAuthButtons";
import { SetupNotice } from "./SetupNotice";

interface RegisterFormProps {
  isConfigured: boolean;
}

export function RegisterForm({ isConfigured }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState<
    AuthActionState,
    FormData
  >(registerAction, { error: null });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState("");

  const displayedError = oauthError || state.error;

  if (state.needsEmailVerification) {
    return (
      <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-[#f2f3f5]">
            Cek Email Kamu
          </h2>
          <p className="text-sm leading-relaxed text-[#b5bac1]">
            Tautan verifikasi telah dikirim ke{" "}
            <span className="font-semibold text-[#f2f3f5]">
              {state.submittedEmail ?? email.trim()}
            </span>
            . Klik tautan tersebut untuk mengaktifkan akun, atau matikan opsi{" "}
            <strong className="text-[#f2f3f5]">Confirm email</strong> di
            Supabase Auth agar demo bisa langsung masuk tanpa verifikasi email.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
        >
          Kembali ke Halaman Masuk
        </Link>
      </div>
    );
  }

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
            htmlFor="register-username"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Username
          </label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            disabled={!isConfigured || isPending}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="misal: firdaus_dev"
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="text-xs text-[#949ba4]">
            3–24 karakter: huruf kecil, angka, atau underscore (_).
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-email"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Email
          </label>
          <input
            id="register-email"
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
            htmlFor="register-password"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Kata Sandi
          </label>
          <div className="relative">
            <input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              disabled={!isConfigured || isPending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
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

        <div className="space-y-1.5">
          <label
            htmlFor="register-confirm-password"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Konfirmasi Kata Sandi
          </label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            disabled={!isConfigured || isPending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi kata sandi"
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={!isConfigured || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          <span>{isPending ? "Mendaftarkan..." : "Buat Akun"}</span>
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
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#8ea1e1] hover:underline"
        >
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}

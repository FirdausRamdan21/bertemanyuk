"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("BertemanYuk error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] px-4 text-[#f2f3f5]">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/25 bg-[#313338] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Terjadi Gangguan Sementara
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#b5bac1]">
          Aplikasi mengalami kendala tak terduga. Coba muat ulang bagian ini
          atau kembali ke halaman utama.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Coba Lagi</span>
          </button>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-white/10 bg-[#2b2d31] px-4 py-2.5 text-sm font-semibold text-[#dbdee1] transition hover:bg-[#35373c]"
          >
            Ke Halaman Masuk
          </Link>
        </div>
      </div>
    </main>
  );
}

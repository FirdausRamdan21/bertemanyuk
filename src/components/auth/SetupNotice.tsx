import { AlertTriangle } from "lucide-react";

/**
 * Banner informasi jika kredensial Supabase di .env.local belum diatur.
 */
export function SetupNotice() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-2">
          <p className="font-semibold text-amber-200">
            Konfigurasi Supabase belum diisi
          </p>
          <p className="text-xs leading-relaxed text-amber-100/85">
            Salin file{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
              .env.example
            </code>{" "}
            menjadi{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
              .env.local
            </code>
            , isi{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            dan{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            , lalu jalankan skrip{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
              supabase/schema.sql
            </code>{" "}
            di Supabase SQL Editor.
          </p>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Compass, MessageSquareCode } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] px-4 text-[#f2f3f5]">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#313338] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865f2]/20 text-[#8ea1e1]">
          <Compass className="h-7 w-7" />
        </div>
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#949ba4]">
          Error 404
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#b5bac1]">
          Channel atau halaman yang kamu tuju tidak tersedia atau mungkin sudah
          dipindahkan.
        </p>

        <Link
          href="/chat"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#5865f2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
        >
          <MessageSquareCode className="h-4 w-4" />
          <span>Kembali ke Ruang Chat</span>
        </Link>
      </div>
    </main>
  );
}

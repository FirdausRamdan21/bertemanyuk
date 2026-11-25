import type { ReactNode } from "react";
import { MessageSquareCode } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1e1f22] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.18),_transparent_52%)]"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#313338] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/25">
            <MessageSquareCode className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#949ba4]">
            BertemanYuk
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f2f3f5]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#b5bac1]">{subtitle}</p>
        </div>

        {children}
      </div>
    </main>
  );
}

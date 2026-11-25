"use client";

import type { ActiveTyper } from "@/types/chat";

interface TypingIndicatorProps {
  typers: ActiveTyper[];
}

function formatTypingLabel(typers: ActiveTyper[]): string {
  if (typers.length === 0) {
    return "";
  }

  if (typers.length === 1) {
    const [first] = typers;
    if (first.mode === "code") {
      return `@${first.username} sedang menulis kode...`;
    }
    if (first.mode === "poll") {
      return `@${first.username} sedang menyiapkan poll...`;
    }
    return `@${first.username} sedang mengetik...`;
  }

  if (typers.length === 2) {
    return `@${typers[0].username} dan @${typers[1].username} sedang mengetik...`;
  }

  return `@${typers[0].username}, @${typers[1].username}, dan ${typers.length - 2} lainnya sedang mengetik...`;
}

export function TypingIndicator({ typers }: TypingIndicatorProps) {
  if (typers.length === 0) {
    return <div className="h-5 px-4" aria-hidden="true" />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-5 items-center gap-2 px-4 text-xs text-[#b5bac1]"
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8ea1e1] [animation-delay:-0.25s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8ea1e1] [animation-delay:-0.12s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8ea1e1]" />
      </span>
      <span className="truncate font-medium">{formatTypingLabel(typers)}</span>
    </div>
  );
}

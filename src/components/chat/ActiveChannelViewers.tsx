"use client";

import type { PresenceUserState } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";

interface ActiveChannelViewersProps {
  viewers: PresenceUserState[];
}

export function ActiveChannelViewers({ viewers }: ActiveChannelViewersProps) {
  if (viewers.length === 0) {
    return null;
  }

  const visible = viewers.slice(0, 4);
  const overflow = viewers.length - visible.length;
  const tooltip = viewers
    .map((v) => (v.vibe ? `@${v.username} (${v.vibe})` : `@${v.username}`))
    .join(", ");

  return (
    <div
      title={`Sedang di channel ini: ${tooltip}`}
      className="hidden items-center gap-2 rounded-full border border-white/10 bg-[#2b2d31] py-0.5 pr-2.5 pl-1 sm:flex"
    >
      <div className="flex -space-x-2">
        {visible.map((viewer) => (
          <div
            key={viewer.userId}
            className="rounded-full ring-2 ring-[#2b2d31]"
          >
            <UserAvatar
              username={viewer.username}
              avatarUrl={viewer.avatarUrl}
              size="sm"
            />
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e1f22] text-[10px] font-bold text-[#b5bac1] ring-2 ring-[#2b2d31]">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium text-[#b5bac1]">
        {viewers.length} di sini
      </span>
    </div>
  );
}

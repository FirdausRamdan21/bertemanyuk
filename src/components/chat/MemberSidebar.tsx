"use client";

import { Shield, Users, X } from "lucide-react";
import type { PresenceUserState } from "@/types/chat";
import type { Profile } from "@/types/database";
import { UserAvatar } from "./UserAvatar";

interface MemberSidebarProps {
  members: Profile[];
  onlineUsers: Record<string, PresenceUserState>;
  currentUserId: string;
  onCloseMobile?: () => void;
}

export function MemberSidebar({
  members,
  onlineUsers,
  currentUserId,
  onCloseMobile,
}: MemberSidebarProps) {
  const onlineMembers = members.filter((m) => Boolean(onlineUsers[m.id]));
  const offlineMembers = members.filter((m) => !onlineUsers[m.id]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-l border-white/10 bg-[#2b2d31]">
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
          <Users className="h-4 w-4 text-[#949ba4]" />
          <span>Anggota ({members.length})</span>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup daftar anggota"
            className="rounded-lg p-1 text-[#949ba4] hover:bg-white/10 hover:text-white xl:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Bagian Online */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Online — {onlineMembers.length}</span>
          </p>

          {onlineMembers.length === 0 ? (
            <p className="px-2 text-xs text-[#6d737d]">
              Menghubungkan Presence...
            </p>
          ) : (
            <ul className="space-y-1">
              {onlineMembers.map((member) => {
                const presence = onlineUsers[member.id];
                const isMe = member.id === currentUserId;

                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-[#35373c]"
                  >
                    <div className="relative">
                      <UserAvatar
                        username={member.username}
                        avatarUrl={member.avatar_url}
                        size="sm"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#2b2d31] bg-emerald-400"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium text-[#f2f3f5]">
                          @{member.username}
                        </span>
                        {member.role === "ADMIN" && (
                          <Shield className="h-3 w-3 shrink-0 text-amber-300" />
                        )}
                        {isMe && (
                          <span className="text-[10px] font-medium text-[#8ea1e1]">
                            (Kamu)
                          </span>
                        )}
                      </div>

                      {presence?.vibe && (
                        <p className="truncate text-[11px] text-[#b5bac1]">
                          {presence.vibe}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Bagian Offline */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1.5 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            <span className="h-2 w-2 rounded-full bg-[#747f8d]" />
            <span>Offline — {offlineMembers.length}</span>
          </p>

          {offlineMembers.length === 0 ? (
            <p className="px-2 text-xs text-[#6d737d]">
              Semua anggota sedang online!
            </p>
          ) : (
            <ul className="space-y-1">
              {offlineMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 opacity-60 transition hover:bg-[#35373c] hover:opacity-90"
                >
                  <div className="relative">
                    <UserAvatar
                      username={member.username}
                      avatarUrl={member.avatar_url}
                      size="sm"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#2b2d31] bg-[#747f8d]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-medium text-[#b5bac1]">
                        @{member.username}
                      </span>
                      {member.role === "ADMIN" && (
                        <Shield className="h-3 w-3 shrink-0 text-amber-300/70" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

"use client";

import {
  Award,
  Bookmark,
  CornerUpLeft,
  Shield,
  Trash2,
} from "lucide-react";
import { formatMessageTime, hasUserMention } from "@/lib/message-format";
import type { ChatMessage } from "@/types/chat";
import type { Profile } from "@/types/database";
import { PollCard } from "./PollCard";
import { RichMessageContent } from "./RichMessageContent";
import { UserAvatar } from "./UserAvatar";

export type ChatDensity = "cozy" | "compact";

interface MessageItemProps {
  message: ChatMessage;
  currentUser: Profile;
  density?: ChatDensity;
  isFocused?: boolean;
  phase2Ready: boolean;
  onReply: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onToggleBookmark: (message: ChatMessage) => void;
  onToggleHighlight: (message: ChatMessage) => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onJumpToMessage: (messageId: string) => void;
}

export function MessageItem({
  message,
  currentUser,
  density = "cozy",
  isFocused = false,
  phase2Ready,
  onReply,
  onDelete,
  onToggleBookmark,
  onToggleHighlight,
  onVotePoll,
  onJumpToMessage,
}: MessageItemProps) {
  const isOwner = message.user_id === currentUser.id;
  const isAdmin = currentUser.role === "ADMIN";
  const canDelete = isOwner || isAdmin;
  const canHighlight = phase2Ready && (isOwner || isAdmin);
  const authorName = message.author?.username ?? "anggota";
  const isAuthorAdmin = message.author?.role === "ADMIN";
  const isMentioningMe = hasUserMention(message.content, currentUser.username);
  const isCompact = density === "compact";

  return (
    <article
      id={`msg-${message.id}`}
      className={`group relative rounded-xl transition ${isCompact ? "px-2.5 py-1.5" : "px-3 py-2.5"
        } ${isFocused
          ? "bg-[#5865f2]/20 ring-1 ring-[#5865f2]/60"
          : message.isHighlighted
            ? "border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
            : isMentioningMe
              ? "border-l-2 border-amber-400 bg-amber-400/[0.07] hover:bg-amber-400/[0.11]"
              : "hover:bg-[#2e3035]"
        }`}
    >
      {/* Toolbar aksi cepat saat hover */}
      <div className="absolute -top-3 right-3 z-10 hidden items-center gap-0.5 rounded-lg border border-white/10 bg-[#2b2d31] p-0.5 shadow-lg group-hover:flex group-focus-within:flex">
        <button
          type="button"
          onClick={() => onReply(message)}
          title="Balas pesan"
          className="rounded-md p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
        >
          <CornerUpLeft className="h-3.5 w-3.5" />
        </button>

        {phase2Ready && (
          <button
            type="button"
            onClick={() => onToggleBookmark(message)}
            title={
              message.isBookmarked
                ? "Hapus dari Saku Pesan"
                : "Simpan ke Saku Pesan (Bookmark Pribadi)"
            }
            className={`rounded-md p-1.5 transition hover:bg-white/10 ${message.isBookmarked
                ? "text-amber-300"
                : "text-[#b5bac1] hover:text-amber-200"
              }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${message.isBookmarked ? "fill-current" : ""}`}
            />
          </button>
        )}

        {canHighlight && (
          <button
            type="button"
            onClick={() => onToggleHighlight(message)}
            title={
              message.isHighlighted
                ? "Lepas tanda Solusi / Keputusan"
                : "Tandai sebagai Solusi / Keputusan"
            }
            className={`rounded-md p-1.5 transition hover:bg-white/10 ${message.isHighlighted
                ? "text-emerald-300"
                : "text-[#b5bac1] hover:text-emerald-200"
              }`}
          >
            <Award className="h-3.5 w-3.5" />
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            title="Hapus pesan"
            className="rounded-md p-1.5 text-[#b5bac1] transition hover:bg-rose-500/20 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Preview pesan yang dibalas */}
      {message.replyTo && (
        <button
          type="button"
          onClick={() => onJumpToMessage(message.replyTo!.id)}
          className={`mb-1 flex max-w-full items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-0.5 text-left text-xs text-[#949ba4] transition hover:bg-white/[0.08] hover:text-[#dbdee1] ${isCompact ? "ml-2" : "ml-12"
            }`}
        >
          <CornerUpLeft className="h-3 w-3 shrink-0 text-[#8ea1e1]" />
          <span className="shrink-0 font-semibold text-[#b5bac1]">
            @{message.replyTo.authorUsername}
          </span>
          <span className="truncate">{message.replyTo.content}</span>
        </button>
      )}

      <div className={`flex items-start ${isCompact ? "gap-2" : "gap-3"}`}>
        {!isCompact && (
          <UserAvatar
            username={authorName}
            avatarUrl={message.author?.avatar_url ?? null}
            size="md"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isCompact && (
              <time
                dateTime={message.created_at}
                className="font-mono text-[10px] text-[#7c828d]"
              >
                {formatMessageTime(message.created_at)}
              </time>
            )}

            <span
              className={`font-semibold text-[#f2f3f5] ${isCompact ? "text-xs" : "text-sm"
                }`}
            >
              @{authorName}
            </span>

            {isAuthorAdmin && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-300">
                <Shield className="h-2.5 w-2.5" />
                ADMIN
              </span>
            )}

            {!isCompact && (
              <time
                dateTime={message.created_at}
                className="text-[11px] text-[#949ba4]"
              >
                {formatMessageTime(message.created_at)}
              </time>
            )}

            {message.isHighlighted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <Award className="h-3 w-3" />
                Solusi / Keputusan
              </span>
            )}

            {message.isBookmarked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                <Bookmark className="h-2.5 w-2.5 fill-current" />
                Tersimpan
              </span>
            )}
          </div>

            {!message.poll && message.content.trim().length > 0 && (
          <div className={isCompact ? "mt-0.5" : "mt-1"}>
            <RichMessageContent
              content={message.content}
              currentUsername={currentUser.username}
            />
          </div>
          )}

          {message.attachment_url && (
            <div className="mt-2">
              <a
                href={message.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.attachment_url}
                  alt={message.attachment_name ?? "Lampiran gambar"}
                  className="max-h-72 max-w-full object-contain sm:max-w-sm"
                />
              </a>
              {message.attachment_name && (
                <p className="mt-1 text-[10px] text-[#949ba4]">
                  {message.attachment_name}
                  {message.attachment_size
                    ? ` (${Math.max(1, Math.round(message.attachment_size / 1024))} KB)`
                    : ""}
                </p>
              )}
            </div>
          )}

          {message.poll && (
            <PollCard
              poll={message.poll}
              currentUserId={currentUser.id}
              onVote={onVotePoll}
            />
          )}

          {/* Tombol aksi ringkas untuk layar sentuh / mobile */}
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#949ba4] sm:hidden">
            <button
              type="button"
              onClick={() => onReply(message)}
              className="hover:text-white"
            >
              Balas
            </button>
            {phase2Ready && (
              <button
                type="button"
                onClick={() => onToggleBookmark(message)}
                className={
                  message.isBookmarked ? "text-amber-300" : "hover:text-white"
                }
              >
                {message.isBookmarked ? "Tersimpan" : "Simpan"}
              </button>
            )}
            {canHighlight && (
              <button
                type="button"
                onClick={() => onToggleHighlight(message)}
                className={
                  message.isHighlighted ? "text-emerald-300" : "hover:text-white"
                }
              >
                {message.isHighlighted ? "Lepas Solusi" : "Tandai Solusi"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className="text-rose-300"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

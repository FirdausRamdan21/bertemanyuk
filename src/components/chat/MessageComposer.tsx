"use client";

import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AtSign,
  BarChart3,
  Code2,
  CornerUpLeft,
  EyeOff,
  Loader2,
  Plus,
  SendHorizontal,
  X,
} from "lucide-react";
import { parsePollCommand } from "@/lib/message-format";
import type { ChatMessage, PresenceUserState, TypingMode } from "@/types/chat";
import type { PollOption, Profile } from "@/types/database";
import { UserAvatar } from "./UserAvatar";

interface MessageComposerProps {
  channelName: string;
  replyTarget: ChatMessage | null;
  members: Profile[];
  onlineUsers: Record<string, PresenceUserState>;
  phase2Ready: boolean;
  isSending: boolean;
  onCancelReply: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onSendPoll: (question: string, options: PollOption[]) => Promise<void>;
  onTyping?: (mode: TypingMode) => void;
}

type MentionTrigger = {
  startIndex: number;
  endIndex: number;
  query: string;
};

function findMentionTrigger(
  text: string,
  cursorPos: number,
): MentionTrigger | null {
  const beforeCursor = text.slice(0, cursorPos);
  const match = /(^|\s)@([a-zA-Z0-9_]*)$/.exec(beforeCursor);
  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  const atIndex = cursorPos - query.length - 1;
  return {
    startIndex: atIndex,
    endIndex: cursorPos,
    query: query.toLowerCase(),
  };
}

export function MessageComposer({
  channelName,
  replyTarget,
  members,
  onlineUsers,
  phase2Ready,
  isSending,
  onCancelReply,
  onSendMessage,
  onSendPoll,
  onTyping,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const [content, setContent] = useState("");
  const [composerError, setComposerError] = useState("");

  // State Mention Autocomplete
  const [mentionTrigger, setMentionTrigger] = useState<MentionTrigger | null>(
    null,
  );
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // State form Quick Poll
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionTrigger) {
      return [];
    }

    const q = mentionTrigger.query;
    return members
      .filter((m) => m.username.toLowerCase().includes(q))
      .sort((a, b) => {
        const aOnline = Boolean(onlineUsers[a.id]) ? 1 : 0;
        const bOnline = Boolean(onlineUsers[b.id]) ? 1 : 0;
        if (aOnline !== bOnline) {
          return bOnline - aOnline;
        }
        return a.username.localeCompare(b.username);
      })
      .slice(0, 6);
  }, [mentionTrigger, members, onlineUsers]);

  const activeMentionIndex =
    mentionSuggestions.length > 0
      ? Math.min(selectedMentionIndex, mentionSuggestions.length - 1)
      : 0;

  function emitTyping(mode: TypingMode) {
    if (!onTyping) {
      return;
    }
    const now = Date.now();
    if (now - lastTypingEmitRef.current >= 1200) {
      lastTypingEmitRef.current = now;
      onTyping(mode);
    }
  }

  function detectTypingMode(value: string): TypingMode {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.startsWith("/poll")) {
      return "poll";
    }
    if (value.includes("`")) {
      return "code";
    }
    return "text";
  }

  function applyMention(member: Profile) {
    if (!mentionTrigger) {
      return;
    }

    const inserted = `@${member.username} `;
    const nextValue =
      content.slice(0, mentionTrigger.startIndex) +
      inserted +
      content.slice(mentionTrigger.endIndex);

    const nextCursor = mentionTrigger.startIndex + inserted.length;
    setContent(nextValue);
    setMentionTrigger(null);
    setSelectedMentionIndex(0);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      }
    });
  }

  function insertSnippet(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}${before}${placeholder}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const nextValue =
      content.slice(0, start) + before + selected + after + content.slice(end);

    setContent(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + before.length;
      textarea.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  }

  async function submitTextOrSlashCommand() {
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }

    setComposerError("");
    setMentionTrigger(null);

    const parsedPoll = parsePollCommand(trimmed);
    if (parsedPoll) {
      if (!phase2Ready) {
        setComposerError(
          "Fitur Quick Poll membutuhkan migrasi SQL Fase 2 (supabase/migrations/002_phase2_features.sql).",
        );
        return;
      }

      if (!parsedPoll.ok) {
        setComposerError(parsedPoll.error);
        return;
      }

      await onSendPoll(parsedPoll.poll.question, parsedPoll.poll.options);
      setContent("");
      return;
    }

    await onSendMessage(trimmed);
    setContent("");
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitTextOrSlashCommand();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionTrigger && mentionSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedMentionIndex(
          (prev) => (prev + 1) % mentionSuggestions.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedMentionIndex(
          (prev) =>
            (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyMention(mentionSuggestions[activeMentionIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionTrigger(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitTextOrSlashCommand();
    }
  }

  async function handleCreatePoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) {
      return;
    }

    setComposerError("");
    const question = pollQuestion.trim();
    const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);

    if (!question) {
      setComposerError("Pertanyaan poll tidak boleh kosong.");
      return;
    }

    if (cleanedOptions.length < 2) {
      setComposerError("Masukkan minimal 2 pilihan jawaban untuk poll.");
      return;
    }

    const formattedOptions: PollOption[] = cleanedOptions.map((text, idx) => ({
      id: `opt_${idx + 1}`,
      text,
    }));

    await onSendPoll(question, formattedOptions);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollBuilder(false);
  }

  return (
    <div className="relative border-t border-white/10 bg-[#313338] px-4 py-3">
      {/* Popup Mention @username Autocomplete */}
      {mentionTrigger && mentionSuggestions.length > 0 && (
        <div className="absolute right-4 bottom-full left-4 z-30 mb-2 max-w-sm overflow-hidden rounded-xl border border-white/10 bg-[#232428] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
            <span className="flex items-center gap-1">
              <AtSign className="h-3 w-3 text-[#8ea1e1]" />
              Sebut Anggota
            </span>
            <span>↑↓ pilih • Enter sisipkan</span>
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {mentionSuggestions.map((member, index) => {
              const isOnline = Boolean(onlineUsers[member.id]);
              const isSelected = index === activeMentionIndex;

              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMention(member);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-[#5865f2] text-white"
                        : "text-[#dbdee1] hover:bg-white/10"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative">
                        <UserAvatar
                          username={member.username}
                          avatarUrl={member.avatar_url}
                          size="sm"
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[#232428] ${
                            isOnline ? "bg-emerald-400" : "bg-[#747f8d]"
                          }`}
                        />
                      </div>
                      <span className="truncate font-semibold">
                        @{member.username}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        isSelected
                          ? "text-white/80"
                          : isOnline
                            ? "text-emerald-300"
                            : "text-[#949ba4]"
                      }`}
                    >
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {composerError && (
        <div
          role="alert"
          className="mb-2.5 flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          <span>{composerError}</span>
          <button
            type="button"
            onClick={() => setComposerError("")}
            className="text-rose-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Banner sedang membalas pesan */}
      {replyTarget && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#5865f2]/30 bg-[#2b2d31] px-3 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-[#b5bac1]">
            <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-[#8ea1e1]" />
            <span className="shrink-0">
              Membalas{" "}
              <strong className="text-[#f2f3f5]">
                @{replyTarget.author?.username ?? "anggota"}
              </strong>
              :
            </span>
            <span className="truncate text-[#949ba4]">
              {replyTarget.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Batalkan balasan"
            className="rounded p-1 text-[#949ba4] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Form Builder Quick Poll */}
      {showPollBuilder && (
        <form
          onSubmit={handleCreatePoll}
          className="mb-3 space-y-3 rounded-xl border border-[#5865f2]/30 bg-[#2b2d31] p-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8ea1e1]">
              <BarChart3 className="h-4 w-4" />
              <span>Buat Quick Poll</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPollBuilder(false)}
              className="rounded p-1 text-[#949ba4] hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            value={pollQuestion}
            onChange={(e) => {
              setPollQuestion(e.target.value);
              if (e.target.value.trim()) {
                emitTyping("poll");
              }
            }}
            placeholder="Tulis pertanyaan voting..."
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
          />

          <div className="space-y-2">
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Pilihan ${idx + 1}`}
                  className="flex-1 rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-1.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-rose-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {pollOptions.length < 6 ? (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Pilihan</span>
              </button>
            ) : (
              <span className="text-[11px] text-[#949ba4]">
                Maksimal 6 pilihan
              </span>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendHorizontal className="h-3.5 w-3.5" />
              )}
              <span>Kirim Poll</span>
            </button>
          </div>
        </form>
      )}

      {/* Kotak input utama */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-xl border border-white/10 bg-[#383a40] transition focus-within:border-[#5865f2]/60"
      >
        <div className="flex items-end gap-2 p-2.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => {
              const next = e.target.value;
              setContent(next);
              const cursor = e.target.selectionStart ?? next.length;
              const trigger = findMentionTrigger(next, cursor);
              setMentionTrigger(trigger);
              if (trigger) {
                setSelectedMentionIndex(0);
              }
              if (next.trim()) {
                emitTyping(detectTypingMode(next));
              }
            }}
            onClick={(e) => {
              const target = e.currentTarget;
              setMentionTrigger(
                findMentionTrigger(target.value, target.selectionStart ?? 0),
              );
            }}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={`Kirim pesan ke #${channelName}… (ketik @ untuk mention, /poll untuk voting)`}
            className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-[#f2f3f5] placeholder:text-[#878c96] focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={isSending || !content.trim()}
            aria-label="Kirim pesan"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5865f2] text-white transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Toolbar format cepat */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-3 py-1.5 text-[11px] text-[#949ba4]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertSnippet("||", "||", "teks rahasia")}
              title="Sisipkan teks spoiler (||blur||)"
              className="inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-white/10 hover:text-[#f2f3f5]"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Spoiler</span>
            </button>

            <button
              type="button"
              onClick={() => insertSnippet("```ts\n", "\n```", "// kode kamu")}
              title="Sisipkan blok kode"
              className="inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-white/10 hover:text-[#f2f3f5]"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Blok Kode</span>
            </button>

            {phase2Ready && (
              <button
                type="button"
                onClick={() => setShowPollBuilder((prev) => !prev)}
                title="Buat Quick Poll"
                className={`inline-flex items-center gap-1 rounded px-2 py-1 transition ${
                  showPollBuilder
                    ? "bg-[#5865f2]/20 text-[#b7c0ff]"
                    : "hover:bg-white/10 hover:text-[#f2f3f5]"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Quick Poll</span>
              </button>
            )}
          </div>

          <span className="hidden sm:inline">
            <kbd className="rounded bg-black/25 px-1 py-0.5 font-mono text-[10px]">
              @
            </kbd>{" "}
            mention •{" "}
            <kbd className="rounded bg-black/25 px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            kirim •{" "}
            <kbd className="rounded bg-black/25 px-1 py-0.5 font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            baris baru
          </span>
        </div>
      </form>
    </div>
  );
}

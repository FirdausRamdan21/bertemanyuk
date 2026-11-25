"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  AtSign,
  BarChart3,
  Code2,
  CornerUpLeft,
  EyeOff,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { parsePollCommand } from "@/lib/message-format";
import type { ChatMessage, PresenceUserState, TypingMode } from "@/types/chat";
import type { PollOption, Profile } from "@/types/database";
import { UserAvatar } from "./UserAvatar";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

interface MessageComposerProps {
  channelName: string;
  replyTarget: ChatMessage | null;
  members: Profile[];
  onlineUsers: Record<string, PresenceUserState>;
  phase2Ready: boolean;
  isSending: boolean;
  disabledReason?: string | null;
  onCancelReply: () => void;
  onSendMessage: (content: string, imageFile: File | null) => Promise<void>;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MessageComposer({
  channelName,
  replyTarget,
  members,
  onlineUsers,
  phase2Ready,
  isSending,
  disabledReason,
  onCancelReply,
  onSendMessage,
  onSendPoll,
  onTyping,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  const [content, setContent] = useState("");
  const [composerError, setComposerError] = useState("");
  const [showTextFeaturesPopup, setShowTextFeaturesPopup] = useState(false);

  // State Lampiran Gambar (Maks 1 gambar, <= 2 MB)
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // State Mention Autocomplete
  const [mentionTrigger, setMentionTrigger] = useState<MentionTrigger | null>(
    null,
  );
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // State form Quick Poll
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

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

  function clearSelectedImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setComposerError("");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setComposerError(
        "Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setComposerError(
        `Ukuran gambar terlalu besar (${formatFileSize(file.size)}). Batas maksimal adalah 2 MB.`,
      );
      event.target.value = "";
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
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
    setShowTextFeaturesPopup(false);
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
      if ((!trimmed && !selectedImage) || isSending) {
        return;
      }

      setComposerError("");
      setMentionTrigger(null);
      setShowTextFeaturesPopup(false);

        if (trimmed) {
          const parsedPoll = parsePollCommand(trimmed);
          if (parsedPoll) {
            if (!phase2Ready) {
              setComposerError(
                "Fitur Polling Cepat membutuhkan migrasi SQL Fase 2.",
              );
              return;
            }

              if (!parsedPoll.ok) {
                setComposerError(parsedPoll.error);
                return;
              }

              await onSendPoll(parsedPoll.poll.question, parsedPoll.poll.options);
              setContent("");
              clearSelectedImage();
              return;
            }
          }

          const imageToSend = selectedImage;
          await onSendMessage(trimmed, imageToSend);
          setContent("");
          clearSelectedImage();
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

        if (disabledReason) {
          return (
            <div className="border-t border-white/10 bg-[#313338] px-4 py-3">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-3 text-xs text-[#949ba4]">
                <Lock className="h-4 w-4 shrink-0 text-amber-300" />
                <span>{disabledReason}</span>
              </div>
            </div>
          );
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
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${isSelected
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
                                className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[#232428] ${isOnline ? "bg-emerald-400" : "bg-[#747f8d]"
                                  }`}
                              />
                            </div>
                            <span className="truncate font-semibold">
                              @{member.username}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] ${isSelected
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
                    {replyTarget.content || "[Lampiran gambar]"}
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

            {/* Pratinjau Gambar Terpilih (Maks 1 gambar, <= 2 MB) */}
            {selectedImage && imagePreviewUrl && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2d31] p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt={selectedImage.name}
                    className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#f2f3f5]">
                      {selectedImage.name}
                    </p>
                    <p className="text-[11px] text-[#949ba4]">
                      {formatFileSize(selectedImage.size)} • Maks 2 MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  aria-label="Hapus gambar terpilih"
                  className="rounded-lg p-1.5 text-[#949ba4] hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Form Builder Polling Cepat */}
            {showPollBuilder && (
              <form
                onSubmit={handleCreatePoll}
                className="mb-3 space-y-3 rounded-xl border border-[#5865f2]/30 bg-[#2b2d31] p-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8ea1e1]">
                    <BarChart3 className="h-4 w-4" />
                    <span>Buat Polling Cepat</span>
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

            {/* Kotak input utama + Tombol Unggah Gambar + Pop-up "Fitur Teks" + Tombol Kirim */}
            <form
              onSubmit={handleFormSubmit}
              className="relative rounded-xl border border-white/10 bg-[#383a40] transition focus-within:border-[#5865f2]/60"
            >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {/* Pop-up Panel "Fitur Teks" */}
                {showTextFeaturesPopup && (
                  <div className="absolute right-2 bottom-full z-30 mb-2 w-60 rounded-xl border border-white/10 bg-[#232428] p-1.5 shadow-2xl">
                    <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                      Fitur Teks
                    </p>
                    <button
                      type="button"
                      onClick={() => insertSnippet("||", "||", "teks rahasia")}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#dbdee1] transition hover:bg-white/10 hover:text-white"
                    >
                      <EyeOff className="h-4 w-4 text-[#8ea1e1]" />
                      <div>
                        <p className="font-semibold">Spoiler</p>
                        <p className="text-[10px] text-[#949ba4]">
                          Teks tersembunyi (||blur||)
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        insertSnippet("```ts\n", "\n```", "// tulis kode di sini")
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#dbdee1] transition hover:bg-white/10 hover:text-white"
                    >
                      <Code2 className="h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="font-semibold">Blok Kode</p>
                        <p className="text-[10px] text-[#949ba4]">
                          Kotak sintaks pemrograman
                        </p>
                      </div>
                    </button>

                    {phase2Ready && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowTextFeaturesPopup(false);
                          setShowPollBuilder((prev) => !prev);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#dbdee1] transition hover:bg-white/10 hover:text-white"
                      >
                        <BarChart3 className="h-4 w-4 text-amber-300" />
                        <div>
                          <p className="font-semibold">Polling Cepat</p>
                          <p className="text-[10px] text-[#949ba4]">
                            Pemungutan suara instan
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-1.5 p-2.5">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => fileInputRef.current?.click()}
                    title="Unggah gambar (maks. 1 gambar, <= 2 MB)"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>

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
                    placeholder={`Kirim pesan ke ${channelName}… (@ untuk mention)`}
                    className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-[#f2f3f5] placeholder:text-[#878c96] focus:outline-none disabled:opacity-60"
                  />

                  {/* Tombol "Fitur Teks" di sisi kanan kotak ketik tepat sebelum tombol Kirim */}
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => setShowTextFeaturesPopup((prev) => !prev)}
                    title="Fitur Teks (Spoiler, Blok Kode, Polling Cepat)"
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${showTextFeaturesPopup
                        ? "bg-[#5865f2]/25 text-[#c7d0ff]"
                        : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Fitur Teks</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSending || (!content.trim() && !selectedImage)}
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
            </form>
          </div>
        );
      }

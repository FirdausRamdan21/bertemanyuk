"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AlertTriangle,
  AlignJustify,
  ArrowDown,
  Award,
  Bookmark,
  Check,
  Code2,
  FileDown,
  Hash,
  Link2,
  Loader2,
  Menu,
  MessageSquare,
  Radio,
  RefreshCw,
  Rows3,
  Search,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { loadChannelMessages } from "@/lib/chat-queries";
import { hasMessageCode, hasMessageLink } from "@/lib/message-format";
import { playNotificationPing } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import type {
  ActiveTyper,
  ChatInitialData,
  ChatMessage,
  MessageFilterType,
  PresenceUserState,
  RealtimeConnectionStatus,
  TypingEventPayload,
  TypingMode,
} from "@/types/chat";
import type {
  Channel,
  Message,
  MessageHighlight,
  Poll,
  PollOption,
  PollVote,
  Profile,
} from "@/types/database";
import { ActiveChannelViewers } from "./ActiveChannelViewers";
import { ChannelSidebar } from "./ChannelSidebar";
import { MemberSidebar } from "./MemberSidebar";
import { MessageComposer } from "./MessageComposer";
import { MessageItem, type ChatDensity } from "./MessageItem";
import { ProfileModal } from "./ProfileModal";
import { TypingIndicator } from "./TypingIndicator";

function normalizePollOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item): item is { id: string; text: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).text === "string",
    )
    .map((item) => ({ id: item.id, text: item.text }));
}

const STORAGE_SYNC_EVENT = "bertemanyuk:local-storage";

function subscribeLocalStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_SYNC_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_SYNC_EVENT, onStoreChange);
  };
}

function getStoredVibe(): string | null {
  try {
    return window.localStorage.getItem("bertemanyuk:vibe");
  } catch {
    return null;
  }
}

function getStoredMuted(): boolean {
  try {
    return window.localStorage.getItem("bertemanyuk:muted") === "true";
  } catch {
    return false;
  }
}

function getStoredDensity(): ChatDensity {
  try {
    return window.localStorage.getItem("bertemanyuk:density") === "compact"
      ? "compact"
      : "cozy";
  } catch {
    return "cozy";
  }
}

export function ChatWorkspace({
  currentUser,
  userEmail,
  channels: initialChannels,
  members: initialMembers,
  initialChannelId,
  initialMessages,
  phase2Ready: initialPhase2Ready,
}: ChatInitialData) {
  const supabase = useMemo(() => createClient(), []);

  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [members, setMembers] = useState<Profile[]>(initialMembers);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    initialChannelId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [phase2Ready, setPhase2Ready] = useState<boolean>(initialPhase2Ready);

  // State Realtime (Fase 3)
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<
    Record<string, PresenceUserState>
  >({});
  const currentVibe = useSyncExternalStore(
    subscribeLocalStorage,
    getStoredVibe,
    () => null,
  );
  const [typingUsers, setTypingUsers] = useState<ActiveTyper[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const soundMuted = useSyncExternalStore(
    subscribeLocalStorage,
    getStoredMuted,
    () => false,
  );
  const density = useSyncExternalStore(
    subscribeLocalStorage,
    getStoredDensity,
    () => "cozy" as ChatDensity,
  );

  // State Smart Scroll & Ekspor Markdown (Fase 4)
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [pendingNewMessages, setPendingNewMessages] = useState(0);
  const [copiedHighlights, setCopiedHighlights] = useState(false);

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [activeFilter, setActiveFilter] = useState<MessageFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);

  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [showDesktopMembers, setShowDesktopMembers] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const isNearBottomRef = useRef<boolean>(true);

  // Refs agar callback Realtime selalu membaca state terbaru tanpa re-subscribe
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  const membersRef = useRef<Profile[]>(members);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const soundMutedRef = useRef<boolean>(soundMuted);
  const currentVibeRef = useRef<string | null>(currentVibe);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  useEffect(() => {
    currentVibeRef.current = currentVibe;
  }, [currentVibe]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  // Daftar anggota lain yang sedang membuka channel aktif yang sama
  const activeChannelViewers = useMemo(() => {
    if (!activeChannelId) {
      return [];
    }
    return Object.values(onlineUsers).filter(
      (u) => u.activeChannelId === activeChannelId,
    );
  }, [onlineUsers, activeChannelId]);

  const filterCounts = useMemo(() => {
    let links = 0;
    let code = 0;
    let bookmarks = 0;
    let highlights = 0;

    for (const msg of messages) {
      if (hasMessageLink(msg.content)) links += 1;
      if (hasMessageCode(msg.content)) code += 1;
      if (msg.isBookmarked) bookmarks += 1;
      if (msg.isHighlighted) highlights += 1;
    }

    return { links, code, bookmarks, highlights };
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return messages.filter((msg) => {
      if (activeFilter === "links" && !hasMessageLink(msg.content)) {
        return false;
      }
      if (activeFilter === "code" && !hasMessageCode(msg.content)) {
        return false;
      }
      if (activeFilter === "bookmarks" && !msg.isBookmarked) {
        return false;
      }
      if (activeFilter === "highlights" && !msg.isHighlighted) {
        return false;
      }

      if (query) {
        const inContent = msg.content.toLowerCase().includes(query);
        const inAuthor = (msg.author?.username ?? "")
          .toLowerCase()
          .includes(query);
        const inPoll = msg.poll
          ? msg.poll.question.toLowerCase().includes(query) ||
          msg.poll.options.some((o) => o.text.toLowerCase().includes(query))
          : false;
        return inContent || inAuthor || inPoll;
      }

      return true;
    });
  }, [messages, activeFilter, searchQuery]);

  // Smart Auto-Scroll: hanya scroll otomatis saat pengguna sudah berada di bagian bawah
  useEffect(() => {
    if (
      activeFilter === "all" &&
      !searchQuery.trim() &&
      !focusedMessageId &&
      isNearBottomRef.current
    ) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    activeChannelId,
    messages.length,
    activeFilter,
    searchQuery,
    focusedMessageId,
  ]);

  // Bersihkan indikator mengetik otomatis setelah 2,5 detik tanpa sinyal lanjutan
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = prev.filter((item) => item.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  // Pastikan profil penulis tersedia walau pengguna baru mendaftar setelah sesi dibuka
  const resolveAuthorProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const existing = membersRef.current.find((m) => m.id === userId);
      if (existing) {
        return existing;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setMembers((prev) => {
          if (prev.some((m) => m.id === data.id)) {
            return prev;
          }
          return [...prev, data].sort((a, b) =>
            a.username.localeCompare(b.username),
          );
        });
      }

      return data ?? null;
    },
    [supabase],
  );

  // 1. SUPABASE REALTIME: Presence (Online/Offline + Vibe + Active Channel) & Broadcast (Smart Typing)
  useEffect(() => {
    const roomChannel = supabase.channel("bertemanyuk:room", {
      config: {
        presence: { key: currentUser.id },
        broadcast: { self: false },
      },
    });

    roomChannelRef.current = roomChannel;

    roomChannel.on("presence", { event: "sync" }, () => {
      const state = roomChannel.presenceState<PresenceUserState>();
      const nextOnline: Record<string, PresenceUserState> = {};

      for (const [key, entries] of Object.entries(state)) {
        const latest = entries[entries.length - 1];
        if (latest) {
          nextOnline[latest.userId || key] = latest;
        }
      }

      setOnlineUsers(nextOnline);
    });

    roomChannel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const data = payload as TypingEventPayload | undefined;
      if (
        !data ||
        data.userId === currentUser.id ||
        data.channelId !== activeChannelIdRef.current
      ) {
        return;
      }

      const expiresAt = Date.now() + 2500;
      setTypingUsers((prev) => {
        const filtered = prev.filter((item) => item.userId !== data.userId);
        return [
          ...filtered,
          {
            userId: data.userId,
            username: data.username,
            mode: data.mode ?? "text",
            expiresAt,
          },
        ];
      });
    });

    roomChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("connected");
        await roomChannel.track({
          userId: currentUser.id,
          username: currentUser.username,
          avatarUrl: currentUser.avatar_url,
          activeChannelId: activeChannelIdRef.current,
          vibe: currentVibeRef.current,
          onlineAt: new Date().toISOString(),
        } satisfies PresenceUserState);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeStatus("error");
      }
    });

    return () => {
      roomChannelRef.current = null;
      void supabase.removeChannel(roomChannel);
    };
  }, [supabase, currentUser.id, currentUser.username, currentUser.avatar_url]);

  // Sinkronkan perubahan channel aktif & Vibe ke Presence tanpa memutus koneksi
  useEffect(() => {
    const roomChannel = roomChannelRef.current;
    if (!roomChannel || realtimeStatus !== "connected") {
      return;
    }

    void roomChannel.track({
      userId: currentUser.id,
      username: currentUser.username,
      avatarUrl: currentUser.avatar_url,
      activeChannelId,
      vibe: currentVibe,
      onlineAt: new Date().toISOString(),
    } satisfies PresenceUserState);
  }, [
    activeChannelId,
    currentVibe,
    realtimeStatus,
    currentUser.id,
    currentUser.username,
    currentUser.avatar_url,
  ]);

  // 2. SUPABASE REALTIME: Postgres Changes (Messages, Channels, Highlights, Polls, Poll Votes)
  useEffect(() => {
    const dbChannel = supabase
      .channel("bertemanyuk:db-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const newMsg = payload.new as Message;

          if (newMsg.channel_id === activeChannelIdRef.current) {
            setTypingUsers((prev) =>
              prev.filter((item) => item.userId !== newMsg.user_id),
            );

            const author = await resolveAuthorProfile(newMsg.user_id);

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }

              const replyTargetMsg = newMsg.reply_to_id
                ? prev.find((m) => m.id === newMsg.reply_to_id) ?? null
                : null;

              const hydrated: ChatMessage = {
                ...newMsg,
                author,
                replyTo: replyTargetMsg
                  ? {
                    id: replyTargetMsg.id,
                    content: replyTargetMsg.content,
                    authorUsername:
                      replyTargetMsg.author?.username ?? "anggota",
                  }
                  : null,
                poll: null,
                isBookmarked: false,
                isHighlighted: false,
                highlightedBy: null,
              };

              return [...prev, hydrated];
            });

            if (newMsg.user_id !== currentUser.id) {
              if (!isNearBottomRef.current) {
                setPendingNewMessages((prev) => prev + 1);
              }
              if (!soundMutedRef.current) {
                playNotificationPing();
              }
            }
          } else if (newMsg.user_id !== currentUser.id) {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.channel_id]: (prev[newMsg.channel_id] ?? 0) + 1,
            }));
            if (!soundMutedRef.current) {
              playNotificationPing();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const oldMsg = payload.old as Partial<Message>;
          if (!oldMsg.id) {
            return;
          }

          setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
          setReplyTarget((prev) => (prev?.id === oldMsg.id ? null : prev));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as Channel;
            setChannels((prev) => {
              if (prev.some((c) => c.id === created.id)) {
                return prev;
              }
              return [...prev, created].sort((a, b) =>
                a.name.localeCompare(b.name),
              );
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Channel;
            setChannels((prev) =>
              prev
                .map((c) => (c.id === updated.id ? updated : c))
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<Channel>;
            if (!deleted.id) {
              return;
            }
            setChannels((prev) => {
              const next = prev.filter((c) => c.id !== deleted.id);
              if (activeChannelIdRef.current === deleted.id) {
                setActiveChannelId(next[0]?.id ?? null);
                setMessages([]);
              }
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_highlights" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const highlight = payload.new as MessageHighlight;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === highlight.message_id
                  ? {
                    ...m,
                    isHighlighted: true,
                    highlightedBy: highlight.highlighted_by,
                  }
                  : m,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const oldHighlight = payload.old as Partial<MessageHighlight>;
            if (!oldHighlight.message_id) {
              return;
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === oldHighlight.message_id
                  ? { ...m, isHighlighted: false, highlightedBy: null }
                  : m,
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "polls" },
        (payload) => {
          const newPoll = payload.new as Poll;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === newPoll.message_id
                ? {
                  ...m,
                  poll: {
                    ...newPoll,
                    options: normalizePollOptions(newPoll.options),
                    votes: m.poll?.votes ?? [],
                  },
                }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const vote = payload.new as PollVote;
            setMessages((prev) =>
              prev.map((m) => {
                if (!m.poll || m.poll.id !== vote.poll_id) {
                  return m;
                }
                const others = m.poll.votes.filter(
                  (v) => v.user_id !== vote.user_id,
                );
                return {
                  ...m,
                  poll: {
                    ...m.poll,
                    votes: [...others, vote],
                  },
                };
              }),
            );
          } else if (payload.eventType === "DELETE") {
            const oldVote = payload.old as Partial<PollVote>;
            if (!oldVote.poll_id || !oldVote.user_id) {
              return;
            }
            setMessages((prev) =>
              prev.map((m) => {
                if (!m.poll || m.poll.id !== oldVote.poll_id) {
                  return m;
                }
                return {
                  ...m,
                  poll: {
                    ...m.poll,
                    votes: m.poll.votes.filter(
                      (v) => v.user_id !== oldVote.user_id,
                    ),
                  },
                };
              }),
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(dbChannel);
    };
  }, [supabase, currentUser.id, resolveAuthorProfile]);

  async function fetchChannelData(channelId: string) {
    setIsLoadingMessages(true);
    setStatusError("");
    try {
      const result = await loadChannelMessages(
        supabase,
        channelId,
        currentUser.id,
        membersRef.current,
      );

      if (result.error) {
        setStatusError(result.error);
      } else {
        setMessages(result.messages);
        setPhase2Ready(result.phase2Ready);
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal memuat riwayat pesan.",
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }

  function handleSelectChannel(channelId: string) {
    if (channelId === activeChannelId) {
      return;
    }
    setActiveChannelId(channelId);
    setReplyTarget(null);
    setActiveFilter("all");
    setSearchQuery("");
    setFocusedMessageId(null);
    setTypingUsers([]);
    setPendingNewMessages(0);
    setIsScrolledUp(false);
    isNearBottomRef.current = true;
    setUnreadCounts((prev) => {
      if (!prev[channelId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    void fetchChannelData(channelId);
  }

  function handleChangeVibe(vibe: string | null) {
    try {
      if (vibe) {
        window.localStorage.setItem("bertemanyuk:vibe", vibe);
      } else {
        window.localStorage.removeItem("bertemanyuk:vibe");
      }
      window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }

  function handleToggleSound() {
    const next = !soundMuted;
    try {
      window.localStorage.setItem("bertemanyuk:muted", String(next));
      window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
    if (!next) {
      playNotificationPing();
    }
  }

  function handleToggleDensity() {
    const next: ChatDensity = density === "cozy" ? "compact" : "cozy";
    try {
      window.localStorage.setItem("bertemanyuk:density", next);
      window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }

  function handleMessagesScroll() {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 90;
    isNearBottomRef.current = nearBottom;
    setIsScrolledUp(!nearBottom);
    if (nearBottom) {
      setPendingNewMessages(0);
    }
  }

  function scrollToBottom() {
    isNearBottomRef.current = true;
    setIsScrolledUp(false);
    setPendingNewMessages(0);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleExportHighlightsMarkdown() {
    if (!activeChannel) {
      return;
    }

    const highlighted = messages.filter((m) => m.isHighlighted);
    if (highlighted.length === 0) {
      return;
    }

    const header = `# Ringkasan Solusi — #${activeChannel.name}\n\n`;
    const body = highlighted
      .map((m, idx) => {
        const author = m.author?.username ?? "anggota";
        const dateStr = new Date(m.created_at).toLocaleString("id-ID");
        return `${idx + 1}. **@${author}** (${dateStr})\n\n${m.content}`;
      })
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(header + body);
      setCopiedHighlights(true);
      setTimeout(() => setCopiedHighlights(false), 2000);
    } catch {
      setStatusError("Gagal menyalin ringkasan ke clipboard browser.");
    }
  }

  function handleBroadcastTyping(mode: TypingMode) {
    const channel = roomChannelRef.current;
    if (!channel || !activeChannelIdRef.current) {
      return;
    }

    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUser.id,
        username: currentUser.username,
        channelId: activeChannelIdRef.current,
        mode,
      } satisfies TypingEventPayload,
    });
  }

  async function handleSendMessage(content: string) {
    if (!activeChannelId) {
      return;
    }

    setIsSending(true);
    setStatusError("");

    try {
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          content,
          channel_id: activeChannelId,
          user_id: currentUser.id,
          reply_to_id: replyTarget?.id ?? null,
        })
        .select("*")
        .single();

      if (error || !inserted) {
        setStatusError(error?.message ?? "Gagal mengirim pesan.");
        return;
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === inserted.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            ...inserted,
            author: currentUser,
            replyTo: replyTarget
              ? {
                id: replyTarget.id,
                content: replyTarget.content,
                authorUsername: replyTarget.author?.username ?? "anggota",
              }
              : null,
            poll: null,
            isBookmarked: false,
            isHighlighted: false,
            highlightedBy: null,
          },
        ];
      });

      setReplyTarget(null);
      setActiveFilter("all");
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal mengirim pesan.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendPoll(question: string, options: PollOption[]) {
    if (!activeChannelId) {
      return;
    }

    setIsSending(true);
    setStatusError("");

    try {
      const { data: insertedMessage, error: messageError } = await supabase
        .from("messages")
        .insert({
          content: `[Poll] ${question}`,
          channel_id: activeChannelId,
          user_id: currentUser.id,
          reply_to_id: replyTarget?.id ?? null,
        })
        .select("*")
        .single();

      if (messageError || !insertedMessage) {
        setStatusError(messageError?.message ?? "Gagal membuat pesan poll.");
        return;
      }

      const { data: insertedPoll, error: pollError } = await supabase
        .from("polls")
        .insert({
          message_id: insertedMessage.id,
          question,
          options,
        })
        .select("*")
        .single();

      if (pollError || !insertedPoll) {
        setStatusError(pollError?.message ?? "Gagal membuat Quick Poll.");
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === insertedMessage.id);
        const pollWithVotes = {
          ...insertedPoll,
          options: normalizePollOptions(insertedPoll.options),
          votes: [],
        };

        if (exists) {
          return prev.map((m) =>
            m.id === insertedMessage.id ? { ...m, poll: pollWithVotes } : m,
          );
        }

        return [
          ...prev,
          {
            ...insertedMessage,
            author: currentUser,
            replyTo: replyTarget
              ? {
                id: replyTarget.id,
                content: replyTarget.content,
                authorUsername: replyTarget.author?.username ?? "anggota",
              }
              : null,
            poll: pollWithVotes,
            isBookmarked: false,
            isHighlighted: false,
            highlightedBy: null,
          },
        ];
      });

      setReplyTarget(null);
      setActiveFilter("all");
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal membuat Quick Poll.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!activeChannelId) {
      return;
    }

    setStatusError("");
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) {
        setStatusError(error.message);
        return;
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (replyTarget?.id === messageId) {
        setReplyTarget(null);
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal menghapus pesan.",
      );
    }
  }

  async function handleToggleBookmark(message: ChatMessage) {
    setStatusError("");
    const nextState = !message.isBookmarked;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, isBookmarked: nextState } : m,
      ),
    );

    try {
      const { error } = nextState
        ? await supabase.from("message_bookmarks").insert({
          user_id: currentUser.id,
          message_id: message.id,
        })
        : await supabase
          .from("message_bookmarks")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("message_id", message.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, isBookmarked: !nextState } : m,
        ),
      );
      setStatusError(
        err instanceof Error ? err.message : "Gagal memperbarui Saku Pesan.",
      );
    }
  }

  async function handleToggleHighlight(message: ChatMessage) {
    if (!activeChannelId) {
      return;
    }

    setStatusError("");
    const nextState = !message.isHighlighted;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
            ...m,
            isHighlighted: nextState,
            highlightedBy: nextState ? currentUser.id : null,
          }
          : m,
      ),
    );

    try {
      const { error } = nextState
        ? await supabase.from("message_highlights").insert({
          message_id: message.id,
          channel_id: activeChannelId,
          highlighted_by: currentUser.id,
        })
        : await supabase
          .from("message_highlights")
          .delete()
          .eq("message_id", message.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
              ...m,
              isHighlighted: !nextState,
              highlightedBy: !nextState ? message.highlightedBy : null,
            }
            : m,
        ),
      );
      setStatusError(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui tanda Solusi / Keputusan.",
      );
    }
  }

  async function handleVotePoll(pollId: string, optionId: string) {
    setStatusError("");
    try {
      const { error } = await supabase.from("poll_votes").upsert(
        {
          poll_id: pollId,
          user_id: currentUser.id,
          option_id: optionId,
        },
        { onConflict: "poll_id,user_id" },
      );

      if (error) {
        setStatusError(error.message);
        return;
      }

      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.poll || msg.poll.id !== pollId) {
            return msg;
          }

          const remainingVotes = msg.poll.votes.filter(
            (v) => v.user_id !== currentUser.id,
          );
          return {
            ...msg,
            poll: {
              ...msg.poll,
              votes: [
                ...remainingVotes,
                {
                  poll_id: pollId,
                  user_id: currentUser.id,
                  option_id: optionId,
                  created_at: new Date().toISOString(),
                },
              ],
            },
          };
        }),
      );
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal menyimpan suara poll.",
      );
    }
  }

  async function handleCreateChannel(
    name: string,
    description: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("channels")
        .insert({
          name,
          description: description || null,
          created_by: currentUser.id,
        })
        .select("*")
        .single();

      if (error) {
        return error.code === "23505"
          ? "Nama channel sudah digunakan."
          : error.message;
      }

      setChannels((prev) => {
        if (prev.some((c) => c.id === data.id)) {
          return prev;
        }
        return [...prev, data].sort((a, b) => a.name.localeCompare(b.name));
      });
      setActiveChannelId(data.id);
      setMessages([]);
      setReplyTarget(null);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Gagal membuat channel.";
    }
  }

  async function handleUpdateChannel(
    channelId: string,
    name: string,
    description: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("channels")
        .update({
          name,
          description: description || null,
        })
        .eq("id", channelId)
        .select("*")
        .single();

      if (error) {
        return error.code === "23505"
          ? "Nama channel sudah digunakan."
          : error.message;
      }

      setChannels((prev) =>
        prev
          .map((c) => (c.id === data.id ? data : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Gagal memperbarui channel.";
    }
  }

  async function handleDeleteChannel(channelId: string) {
    setStatusError("");
    try {
      const { error } = await supabase
        .from("channels")
        .delete()
        .eq("id", channelId);

      if (error) {
        setStatusError(error.message);
        return;
      }

      const nextChannels = channels.filter((c) => c.id !== channelId);
      setChannels(nextChannels);

      if (activeChannelId === channelId) {
        const fallback = nextChannels[0]?.id ?? null;
        setActiveChannelId(fallback);
        if (fallback) {
          void fetchChannelData(fallback);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal menghapus channel.",
      );
    }
  }

  function handleJumpToMessage(messageId: string) {
    setActiveFilter("all");
    setSearchQuery("");
    setFocusedMessageId(messageId);

    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    setTimeout(() => {
      setFocusedMessageId((prev) => (prev === messageId ? null : prev));
    }, 2200);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#313338] text-[#f2f3f5]">
      {/* Sidebar Kiri (Desktop) */}
      <div className="hidden lg:flex">
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannelId}
          unreadCounts={unreadCounts}
          currentUser={currentUser}
          currentVibe={currentVibe}
          onChangeVibe={handleChangeVibe}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={handleCreateChannel}
          onUpdateChannel={handleUpdateChannel}
          onDeleteChannel={handleDeleteChannel}
          onOpenProfile={() => setShowProfileModal(true)}
        />
      </div>

      {/* Drawer Sidebar Kiri (Mobile) */}
      {showLeftDrawer && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative z-10 flex h-full">
            <ChannelSidebar
              channels={channels}
              activeChannelId={activeChannelId}
              unreadCounts={unreadCounts}
              currentUser={currentUser}
              currentVibe={currentVibe}
              onChangeVibe={handleChangeVibe}
              onSelectChannel={handleSelectChannel}
              onCreateChannel={handleCreateChannel}
              onUpdateChannel={handleUpdateChannel}
              onDeleteChannel={handleDeleteChannel}
              onOpenProfile={() => {
                setShowLeftDrawer(false);
                setShowProfileModal(true);
              }}
              onCloseMobile={() => setShowLeftDrawer(false)}
            />
          </div>
          <button
            type="button"
            aria-label="Tutup overlay channel"
            onClick={() => setShowLeftDrawer(false)}
            className="flex-1 bg-black/60"
          />
        </div>
      )}

      {/* Kolom Tengah: Area Chat */}
      <main className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        {/* Header Channel */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowLeftDrawer(true)}
              aria-label="Buka daftar channel"
              className="rounded-lg p-1.5 text-[#b5bac1] hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Hash className="h-5 w-5 shrink-0 text-[#80848e]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold text-[#f2f3f5] sm:text-base">
                  {activeChannel?.name ?? "Pilih Channel"}
                </h1>
                <span
                  title={
                    realtimeStatus === "connected"
                      ? "Supabase Realtime terhubung"
                      : realtimeStatus === "connecting"
                        ? "Menghubungkan Supabase Realtime..."
                        : "Koneksi Realtime terganggu"
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${realtimeStatus === "connected"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : realtimeStatus === "connecting"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-rose-500/15 text-rose-300"
                    }`}
                >
                  <Radio className="h-2.5 w-2.5" />
                  <span>
                    {realtimeStatus === "connected"
                      ? "Live"
                      : realtimeStatus === "connecting"
                        ? "Sync..."
                        : "Offline"}
                  </span>
                </span>
                {activeChannel?.description && (
                  <span className="hidden truncate border-l border-white/15 pl-2 text-xs text-[#949ba4] xl:inline">
                    {activeChannel.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ActiveChannelViewers viewers={activeChannelViewers} />

            <button
              type="button"
              onClick={handleToggleDensity}
              title={
                density === "cozy"
                  ? "Ubah ke Mode Ringkas (Compact)"
                  : "Ubah ke Mode Nyaman (Cozy)"
              }
              className="rounded-lg p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
            >
              {density === "cozy" ? (
                <Rows3 className="h-4 w-4" />
              ) : (
                <AlignJustify className="h-4 w-4 text-[#8ea1e1]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleSound}
              title={
                soundMuted
                  ? "Aktifkan suara notifikasi"
                  : "Bisukan suara notifikasi"
              }
              className={`rounded-lg p-2 transition ${soundMuted
                ? "text-[#6d737d] hover:bg-white/10 hover:text-[#b5bac1]"
                : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
            >
              {soundMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            {activeChannelId && (
              <button
                type="button"
                onClick={() => void fetchChannelData(activeChannelId)}
                disabled={isLoadingMessages}
                title="Sinkronkan ulang pesan"
                className="rounded-lg p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingMessages ? "animate-spin" : ""}`}
                />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDesktopMembers((prev) => !prev)}
              title="Tampilkan / sembunyikan daftar anggota"
              className={`hidden rounded-lg p-2 transition xl:inline-flex ${showDesktopMembers
                ? "bg-white/10 text-white"
                : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
            >
              <Users className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowRightDrawer(true)}
              title="Buka daftar anggota"
              className="rounded-lg p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white xl:hidden"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Bar Filter Cepat & Pencarian */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#2b2d31]/60 px-4 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Semua"
              count={messages.length}
            />
            <FilterPill
              active={activeFilter === "links"}
              onClick={() => setActiveFilter("links")}
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Link"
              count={filterCounts.links}
            />
            <FilterPill
              active={activeFilter === "code"}
              onClick={() => setActiveFilter("code")}
              icon={<Code2 className="h-3.5 w-3.5" />}
              label="Kode"
              count={filterCounts.code}
            />
            {phase2Ready && (
              <>
                <FilterPill
                  active={activeFilter === "bookmarks"}
                  onClick={() => setActiveFilter("bookmarks")}
                  icon={<Bookmark className="h-3.5 w-3.5" />}
                  label="Saku Pesan"
                  count={filterCounts.bookmarks}
                />
                <FilterPill
                  active={activeFilter === "highlights"}
                  onClick={() => setActiveFilter("highlights")}
                  icon={<Award className="h-3.5 w-3.5" />}
                  label="Solusi"
                  count={filterCounts.highlights}
                />
                {filterCounts.highlights > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleExportHighlightsMarkdown()}
                    title="Salin seluruh pesan bertanda Solusi dalam format Markdown"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {copiedHighlights ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Tersalin (.md)</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Salin Solusi</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#949ba4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari di channel ini..."
              className="w-full rounded-lg border border-white/10 bg-[#1e1f22] py-1 pr-7 pl-8 text-xs text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus pencarian"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-[#949ba4] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notifikasi jika migrasi SQL Fase 2 belum dijalankan */}
        {!phase2Ready && (
          <div className="flex items-start gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="leading-relaxed">
              Jalankan{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
                supabase/migrations/002_phase2_features.sql
              </code>{" "}
              di Supabase SQL Editor untuk mengaktifkan fitur{" "}
              <strong>Saku Pesan (Bookmark)</strong>,{" "}
              <strong>Tandai Solusi</strong>, dan <strong>Quick Poll</strong>.
            </p>
          </div>
        )}

        {statusError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200"
          >
            <span>{statusError}</span>
            <button
              type="button"
              onClick={() => setStatusError("")}
              className="text-rose-300 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Daftar Pesan */}
        <div
          ref={scrollContainerRef}
          onScroll={handleMessagesScroll}
          className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {!activeChannel ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-[#949ba4]">
              <Hash className="mb-2 h-10 w-10 text-[#6d737d]" />
              <p className="text-sm font-medium text-[#dbdee1]">
                Belum ada channel tersedia
              </p>
              <p className="mt-1 text-xs">
                Jalankan seed channel di SQL Editor atau buat channel baru
                sebagai Admin.
              </p>
            </div>
          ) : isLoadingMessages ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#949ba4]">
              <Loader2 className="h-5 w-5 animate-spin text-[#5865f2]" />
              <span>Memuat pesan #{activeChannel.name}...</span>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2b2d31] text-[#8ea1e1]">
                <Hash className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#f2f3f5]">
                {messages.length === 0
                  ? `Selamat datang di #${activeChannel.name}!`
                  : "Tidak ada pesan yang cocok dengan filter"}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#949ba4]">
                {messages.length === 0
                  ? "Mulai obrolan pertama, bagikan potongan kode, sisipkan ||spoiler||, atau buat /poll instan untuk komunitas."
                  : "Coba ubah filter cepat atau kata kunci pencarian di atas."}
              </p>
              {activeFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-3 rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4]"
                >
                  Tampilkan Semua Pesan
                </button>
              )}
            </div>
          ) : (
            <div className={density === "compact" ? "space-y-0.5" : "space-y-1.5"}>
              {filteredMessages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  currentUser={currentUser}
                  density={density}
                  isFocused={focusedMessageId === msg.id}
                  phase2Ready={phase2Ready}
                  onReply={setReplyTarget}
                  onDelete={(id) => void handleDeleteMessage(id)}
                  onToggleBookmark={(m) => void handleToggleBookmark(m)}
                  onToggleHighlight={(m) => void handleToggleHighlight(m)}
                  onVotePoll={(pollId, optionId) =>
                    void handleVotePoll(pollId, optionId)
                  }
                  onJumpToMessage={handleJumpToMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Pil Melayang Smart Auto-Scroll */}
        {(isScrolledUp || pendingNewMessages > 0) &&
          activeFilter === "all" &&
          !searchQuery.trim() && (
            <div className="relative flex justify-center">
              <button
                type="button"
                onClick={scrollToBottom}
                className={`absolute -top-11 z-20 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg transition ${
                  pendingNewMessages > 0
                    ? "bg-[#5865f2] text-white hover:bg-[#4752c4]"
                    : "border border-white/10 bg-[#232428] text-[#dbdee1] hover:bg-[#2b2d31]"
                }`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>
                  {pendingNewMessages > 0
                    ? `${pendingNewMessages} pesan baru`
                    : "Ke pesan terbaru"}
                </span>
              </button>
            </div>
          )}

        {/* Smart Typing Indicator (Broadcast) */}
        <TypingIndicator typers={typingUsers} />

        {/* Composer */}
        {activeChannel && (
          <MessageComposer
            channelName={activeChannel.name}
            replyTarget={replyTarget}
            members={members}
            onlineUsers={onlineUsers}
            phase2Ready={phase2Ready}
            isSending={isSending}
            onCancelReply={() => setReplyTarget(null)}
            onSendMessage={handleSendMessage}
            onSendPoll={handleSendPoll}
            onTyping={handleBroadcastTyping}
          />
        )}
      </main>

      {/* Sidebar Kanan (Desktop) */}
      {showDesktopMembers && (
        <div className="hidden xl:flex">
          <MemberSidebar
            members={members}
            onlineUsers={onlineUsers}
            currentUserId={currentUser.id}
          />
        </div>
      )}

      {/* Drawer Sidebar Kanan (Mobile/Tablet) */}
      {showRightDrawer && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <button
            type="button"
            aria-label="Tutup overlay anggota"
            onClick={() => setShowRightDrawer(false)}
            className="flex-1 bg-black/60"
          />
          <div className="relative z-10 flex h-full">
            <MemberSidebar
              members={members}
              onlineUsers={onlineUsers}
              currentUserId={currentUser.id}
              onCloseMobile={() => setShowRightDrawer(false)}
            />
          </div>
        </div>
      )}

      {/* Modal Edit Profil */}
      <ProfileModal
        isOpen={showProfileModal}
        profile={currentUser}
        email={userEmail}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}

function FilterPill({ active, onClick, icon, label, count }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${active
        ? "bg-[#5865f2] text-white"
        : "bg-[#1e1f22] text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
        }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-black/20 text-white" : "bg-white/5 text-[#949ba4]"
          }`}
      >
        {count}
      </span>
    </button>
  );
}

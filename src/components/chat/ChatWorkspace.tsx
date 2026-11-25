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
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  Code2,
  FileDown,
  FolderKanban,
  Hash,
  Info,
  Link2,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Radio,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { loadChannelMessages } from "@/lib/chat-queries";
import {
  loadCommunityWorkspaceData,
  loadUserCommunities,
} from "@/lib/community-queries";
import { hasMessageCode, hasMessageLink } from "@/lib/message-format";
import { playNotificationPing } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import type {
  ActiveTyper,
  ChatInitialData,
  ChatMessage,
  MemberWithCommunityRole,
  MessageFilterType,
  PresenceUserState,
  RealtimeConnectionStatus,
  TypingEventPayload,
  TypingMode,
} from "@/types/chat";
import type {
  Channel,
  Community,
  CommunityRole,
  Database,
  Message,
  MessageHighlight,
  Poll,
  PollOption,
  PollVote,
  Profile,
  RoomType,
} from "@/types/database";
import { ActiveChannelViewers } from "./ActiveChannelViewers";
import { ChannelSidebar } from "./ChannelSidebar";
import { CollectionView } from "./CollectionView";
import { CommunityRail } from "./CommunityRail";
import { CommunityRolesModal } from "./CommunityRolesModal";
import { MemberSidebar } from "./MemberSidebar";
import { MessageComposer } from "./MessageComposer";
import { MessageItem, type ChatDensity } from "./MessageItem";
import { ProfileModal } from "./ProfileModal";
import { RoomInfoPanel } from "./RoomInfoPanel";
import { RoomSettingsModal } from "./RoomSettingsModal";
import { TypingIndicator } from "./TypingIndicator";
import { UserAvatar } from "./UserAvatar";

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
  v2Ready: initialV2Ready,
  communities: initialCommunities,
  initialCommunityId,
  initialCommunityRoles,
  channels: initialChannels,
  members: initialMembers,
  initialChannelId,
  initialMessages,
  phase2Ready: initialPhase2Ready,
}: ChatInitialData) {
  const supabase = useMemo(() => createClient(), []);

  // State v2.0 Komunitas & Peran
  const [v2Ready, setV2Ready] = useState<boolean>(initialV2Ready);
  const [communities, setCommunities] =
    useState<Community[]>(initialCommunities);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    initialCommunityId,
  );
  const [communityRoles, setCommunityRoles] = useState<CommunityRole[]>(
    initialCommunityRoles,
  );

  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [members, setMembers] =
    useState<MemberWithCommunityRole[]>(initialMembers);
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
  const [rightPanelMode, setRightPanelMode] = useState<
    "members" | "info" | "none"
  >("members");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const isNearBottomRef = useRef<boolean>(true);

  const activeCommunityIdRef = useRef<string | null>(activeCommunityId);
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  const membersRef = useRef<MemberWithCommunityRole[]>(members);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const soundMutedRef = useRef<boolean>(soundMuted);
  const currentVibeRef = useRef<string | null>(currentVibe);

  useEffect(() => {
    activeCommunityIdRef.current = activeCommunityId;
  }, [activeCommunityId]);

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

  const activeCommunity = useMemo(
    () => communities.find((c) => c.id === activeCommunityId) ?? null,
    [communities, activeCommunityId],
  );

  const currentCommunityRole = useMemo(() => {
    const me = members.find((m) => m.id === currentUser.id);
    return me?.communityRole ?? null;
  }, [members, currentUser.id]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  const activeRoomType: RoomType = activeChannel?.room_type ?? "chat";

  // Hitung jumlah pengguna per ruang (Presence) untuk badge Ruang Suara & header
  const roomViewerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const user of Object.values(onlineUsers)) {
      if (user.activeChannelId) {
        counts[user.activeChannelId] = (counts[user.activeChannelId] ?? 0) + 1;
      }
    }
    return counts;
  }, [onlineUsers]);

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

  // Smart Auto-Scroll
  useEffect(() => {
    if (
      activeRoomType === "chat" &&
      activeFilter === "all" &&
      !searchQuery.trim() &&
      !focusedMessageId &&
      isNearBottomRef.current
    ) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    activeRoomType,
    activeChannelId,
    messages.length,
    activeFilter,
    searchQuery,
    focusedMessageId,
  ]);

  // Bersihkan indikator mengetik otomatis setelah 2,5 detik
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
          return [...prev, { ...data, communityRole: null }].sort((a, b) =>
            a.username.localeCompare(b.username),
          );
        });
      }

      return data ?? null;
    },
    [supabase],
  );

  // 1. SUPABASE REALTIME: Presence & Broadcast
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

  // 2. SUPABASE REALTIME: Postgres Changes
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
          const activeComm = activeCommunityIdRef.current;

          if (payload.eventType === "INSERT") {
            const created = payload.new as Channel;
            if (activeComm && created.community_id !== activeComm) {
              return;
            }
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
            if (activeComm && updated.community_id !== activeComm) {
              return;
            }
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

  async function fetchChannelData(
    channelId: string,
    memberList: MemberWithCommunityRole[] = membersRef.current,
  ) {
    setIsLoadingMessages(true);
    setStatusError("");
    try {
      const result = await loadChannelMessages(
        supabase,
        channelId,
        currentUser.id,
        memberList,
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

  async function switchCommunity(communityId: string) {
    setIsLoadingMessages(true);
    setStatusError("");
    setActiveCommunityId(communityId);
    setReplyTarget(null);
    setActiveFilter("all");
    setSearchQuery("");
    setTypingUsers([]);
    setPendingNewMessages(0);
    setIsScrolledUp(false);
    isNearBottomRef.current = true;

    try {
      const data = await loadCommunityWorkspaceData(supabase, communityId);
      setChannels(data.channels);
      setCommunityRoles(data.roles);
      setMembers(data.members);

      const defaultRoom =
        data.channels.find((c) => (c.room_type ?? "chat") === "chat") ??
        data.channels[0] ??
        null;

      setActiveChannelId(defaultRoom?.id ?? null);

      if (defaultRoom) {
        const msgRes = await loadChannelMessages(
          supabase,
          defaultRoom.id,
          currentUser.id,
          data.members,
        );
        setMessages(msgRes.messages);
        setPhase2Ready(msgRes.phase2Ready);
      } else {
        setMessages([]);
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Gagal memuat data komunitas.",
      );
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleCreateCommunity(
    name: string,
    description: string,
  ): Promise<string | null> {
    try {
      const { data: created, error } = await supabase
        .from("communities")
        .insert({
          name,
          description: description || null,
          owner_id: currentUser.id,
        })
        .select("*")
        .single();

      if (error || !created) {
        return error?.message ?? "Gagal membuat komunitas.";
      }

      setV2Ready(true);
      setCommunities((prev) => [...prev, created]);
      await switchCommunity(created.id);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Gagal membuat komunitas.";
    }
  }

  async function handleJoinCommunity(inviteCode: string): Promise<string | null> {
    try {
      const { data: joinedId, error } = await supabase.rpc(
        "join_community_by_code",
        {
          p_invite_code: inviteCode,
        },
      );

      if (error || !joinedId) {
        return error?.message ?? "Kode undangan tidak ditemukan.";
      }

      const commRes = await loadUserCommunities(supabase, currentUser.id);
      setCommunities(commRes.communities);
      await switchCommunity(joinedId);
      return null;
    } catch (err) {
      return err instanceof Error
        ? err.message
        : "Gagal bergabung ke komunitas.";
    }
  }

  async function handleCreateRole(name: string): Promise<string | null> {
    if (!activeCommunityId) {
      return "Tidak ada komunitas aktif.";
    }

    const slug = `${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}_${Date.now().toString(36).slice(-4)}`;

    const { data, error } = await supabase
      .from("community_roles")
      .insert({
        community_id: activeCommunityId,
        name,
        slug,
        is_system: false,
      })
      .select("*")
      .single();

    if (error || !data) {
      return error?.message ?? "Gagal membuat peran baru.";
    }

    setCommunityRoles((prev) => [...prev, data]);
    return null;
  }

  async function handleUpdateRolePermission(
    roleId: string,
    field: keyof Pick<
      CommunityRole,
      | "can_create_room"
      | "can_update_room"
      | "can_delete_room"
      | "can_moderate_members"
      | "can_send_messages"
    >,
    value: boolean,
  ): Promise<string | null> {
    const patch: Database["public"]["Tables"]["community_roles"]["Update"] = {
      [field]: value,
    };

    const { data, error } = await supabase
      .from("community_roles")
      .update(patch)
      .eq("id", roleId)
      .select("*")
      .single();

    if (error || !data) {
      return error?.message ?? "Gagal memperbarui izin peran.";
    }

    setCommunityRoles((prev) => prev.map((r) => (r.id === roleId ? data : r)));
    setMembers((prev) =>
      prev.map((m) =>
        m.communityRole?.id === roleId ? { ...m, communityRole: data } : m,
      ),
    );
    return null;
  }

  async function handleDeleteRole(roleId: string): Promise<string | null> {
    const { error } = await supabase
      .from("community_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      return error.message;
    }

    setCommunityRoles((prev) => prev.filter((r) => r.id !== roleId));
    setMembers((prev) =>
      prev.map((m) =>
        m.communityRole?.id === roleId ? { ...m, communityRole: null } : m,
      ),
    );
    return null;
  }

  async function handleAssignMemberRole(
    userId: string,
    roleId: string,
  ): Promise<string | null> {
    if (!activeCommunityId) {
      return "Tidak ada komunitas aktif.";
    }

    const { error } = await supabase
      .from("community_members")
      .update({ role_id: roleId })
      .eq("community_id", activeCommunityId)
      .eq("user_id", userId);

    if (error) {
      return error.message;
    }

    const targetRole = communityRoles.find((r) => r.id === roleId) ?? null;
    setMembers((prev) =>
      prev.map((m) =>
        m.id === userId ? { ...m, communityRole: targetRole } : m,
      ),
    );
    return null;
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
      // Abaikan
    }
  }

  function handleToggleSound() {
    const next = !soundMuted;
    try {
      window.localStorage.setItem("bertemanyuk:muted", String(next));
      window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    } catch {
      // Abaikan
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
      // Abaikan
    }
  }

  function handleMessagesScroll() {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
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

    const header = `# Ringkasan Solusi — ${activeChannel.name}\n\n`;
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

    async function handleSendMessage(content: string, imageFile: File | null) {
      if (!activeChannelId) {
        return;
      }

      setIsSending(true);
      setStatusError("");

      try {
        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        let attachmentSize: number | null = null;

        if (imageFile) {
          const safeFileName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `${currentUser.id}/${Date.now()}_${safeFileName}`;

          const { error: uploadError } = await supabase.storage
            .from("chat-media")
            .upload(storagePath, imageFile, {
              contentType: imageFile.type,
              upsert: false,
            });

          if (uploadError) {
            setStatusError(
              `Gagal mengunggah gambar: ${uploadError.message}`,
            );
            return;
          }

          const { data: publicData } = supabase.storage
            .from("chat-media")
            .getPublicUrl(storagePath);

          attachmentUrl = publicData.publicUrl;
          attachmentName = imageFile.name;
          attachmentSize = imageFile.size;
        }

        const payload: Database["public"]["Tables"]["messages"]["Insert"] =
          attachmentUrl
            ? {
              content: content || "",
              channel_id: activeChannelId,
              user_id: currentUser.id,
              reply_to_id: replyTarget?.id ?? null,
              attachment_url: attachmentUrl,
              attachment_name: attachmentName,
              attachment_size: attachmentSize,
            }
            : {
              content,
              channel_id: activeChannelId,
              user_id: currentUser.id,
              reply_to_id: replyTarget?.id ?? null,
            };

        const { data: inserted, error } = await supabase
          .from("messages")
          .insert(payload)
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
    roomType: RoomType,
  ): Promise<string | null> {
    try {
      const insertPayload: Database["public"]["Tables"]["channels"]["Insert"] =
        v2Ready
          ? {
            name,
            description: description || null,
            created_by: currentUser.id,
            community_id: activeCommunityId,
            room_type: roomType,
          }
          : {
            name,
            description: description || null,
            created_by: currentUser.id,
          };

      const { data, error } = await supabase
        .from("channels")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error || !data) {
        return error?.code === "23505"
          ? "Nama ruang sudah digunakan di komunitas ini."
          : (error?.message ?? "Gagal membuat ruang.");
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
      return err instanceof Error ? err.message : "Gagal membuat ruang.";
    }
  }

  async function handleCreateRoomInCollection(
    name: string,
    description: string,
    roomType: Exclude<RoomType, "collection">,
    subcategory: string,
  ): Promise<string | null> {
    if (!activeChannel || activeChannel.room_type !== "collection") {
      return "Koleksi aktif tidak ditemukan.";
    }

    try {
      const insertPayload: Database["public"]["Tables"]["channels"]["Insert"] =
      {
        name,
        description: description || null,
        created_by: currentUser.id,
        community_id: activeCommunityId,
        room_type: roomType,
        parent_collection_id: activeChannel.id,
        subcategory: subcategory || "Umum",
      };

      const { data, error } = await supabase
        .from("channels")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error || !data) {
        return error?.code === "23505"
          ? "Nama ruang sudah digunakan di komunitas ini."
          : (error?.message ?? "Gagal menambahkan ruang ke koleksi.");
      }

      setChannels((prev) => {
        if (prev.some((c) => c.id === data.id)) {
          return prev;
        }
        return [...prev, data].sort((a, b) => a.name.localeCompare(b.name));
      });
      return null;
    } catch (err) {
      return err instanceof Error
        ? err.message
        : "Gagal menambahkan ruang ke koleksi.";
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

      if (error || !data) {
        return error?.code === "23505"
          ? "Nama ruang sudah digunakan."
          : (error?.message ?? "Gagal memperbarui ruang.");
      }

      setChannels((prev) =>
        prev
          .map((c) => (c.id === data.id ? data : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Gagal memperbarui ruang.";
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
        err instanceof Error ? err.message : "Gagal menghapus ruang.",
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

  const canModerateMessages =
    currentUser.role === "ADMIN" ||
    Boolean(currentCommunityRole?.can_moderate_members) ||
    activeCommunity?.owner_id === currentUser.id;

  const canManageActiveRoom =
    currentUser.role === "ADMIN" ||
    activeCommunity?.owner_id === currentUser.id ||
    Boolean(currentCommunityRole?.can_update_room) ||
    (activeRoomType === "collection" &&
      activeChannel?.created_by === currentUser.id);

  const canCreateInCollection =
    canManageActiveRoom || Boolean(currentCommunityRole?.can_create_room);

  const parentCollection = useMemo(() => {
    if (!activeChannel?.parent_collection_id) {
      return null;
    }
    return (
      channels.find((c) => c.id === activeChannel.parent_collection_id) ?? null
    );
  }, [channels, activeChannel]);

  const composerDisabledReason = useMemo(() => {
    if (!activeChannel) {
      return null;
    }
    if (activeChannel.allow_member_messages === false && !canModerateMessages) {
      return "Hanya Pemilik dan Pengurus yang dapat mengirim pesan di ruang ini.";
    }
    if (
      v2Ready &&
      currentCommunityRole &&
      !currentCommunityRole.can_send_messages &&
      !canModerateMessages
    ) {
      return "Peran kamu di komunitas ini tidak memiliki izin mengirim pesan.";
    }
    return null;
  }, [activeChannel, canModerateMessages, v2Ready, currentCommunityRole]);

  const activeTabSettings = useMemo(
    () => ({
      links: activeChannel?.settings?.tabs?.links ?? true,
      code: activeChannel?.settings?.tabs?.code ?? true,
      bookmarks: activeChannel?.settings?.tabs?.bookmarks ?? true,
      solutions: activeChannel?.settings?.tabs?.solutions ?? true,
    }),
    [activeChannel?.settings],
  );

  // Untuk MessageItem, Admin sistem atau Pemilik/Pengurus komunitas boleh moderasi/solusi
  const effectiveUserForMessage = useMemo(
    () =>
      canModerateMessages
        ? { ...currentUser, role: "ADMIN" as const }
        : currentUser,
    [currentUser, canModerateMessages],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#313338] text-[#f2f3f5]">
      {/* Rail Komunitas + Sidebar Ruang (Desktop) */}
      <div className="hidden lg:flex">
        <CommunityRail
          communities={communities}
          activeCommunityId={activeCommunityId}
          v2Ready={v2Ready}
          onSelectCommunity={(id) => void switchCommunity(id)}
          onCreateCommunity={handleCreateCommunity}
          onJoinCommunity={handleJoinCommunity}
        />

        <ChannelSidebar
          activeCommunity={activeCommunity}
          currentCommunityRole={currentCommunityRole}
          channels={channels}
          activeChannelId={activeChannelId}
          unreadCounts={unreadCounts}
          roomViewerCounts={roomViewerCounts}
          currentUser={currentUser}
          currentVibe={currentVibe}
          v2Ready={v2Ready}
          onChangeVibe={handleChangeVibe}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={handleCreateChannel}
          onUpdateChannel={handleUpdateChannel}
          onDeleteChannel={handleDeleteChannel}
          onOpenRolesModal={() => setShowRolesModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
        />
      </div>

      {/* Drawer Kiri (Mobile) */}
      {showLeftDrawer && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative z-10 flex h-full">
            <CommunityRail
              communities={communities}
              activeCommunityId={activeCommunityId}
              v2Ready={v2Ready}
              onSelectCommunity={(id) => void switchCommunity(id)}
              onCreateCommunity={handleCreateCommunity}
              onJoinCommunity={handleJoinCommunity}
            />
            <ChannelSidebar
              activeCommunity={activeCommunity}
              currentCommunityRole={currentCommunityRole}
              channels={channels}
              activeChannelId={activeChannelId}
              unreadCounts={unreadCounts}
              roomViewerCounts={roomViewerCounts}
              currentUser={currentUser}
              currentVibe={currentVibe}
              v2Ready={v2Ready}
              onChangeVibe={handleChangeVibe}
              onSelectChannel={handleSelectChannel}
              onCreateChannel={handleCreateChannel}
              onUpdateChannel={handleUpdateChannel}
              onDeleteChannel={handleDeleteChannel}
              onOpenRolesModal={() => {
                setShowLeftDrawer(false);
                setShowRolesModal(true);
              }}
              onOpenProfile={() => {
                setShowLeftDrawer(false);
                setShowProfileModal(true);
              }}
              onCloseMobile={() => setShowLeftDrawer(false)}
            />
          </div>
          <button
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setShowLeftDrawer(false)}
            className="flex-1 bg-black/60"
          />
        </div>
      )}

      {/* Kolom Tengah: Area Ruang Aktif */}
      <main className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        {/* Header Ruang */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowLeftDrawer(true)}
              aria-label="Buka daftar ruang"
              className="rounded-lg p-1.5 text-[#b5bac1] hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {parentCollection && (
              <button
                type="button"
                onClick={() => handleSelectChannel(parentCollection.id)}
                title={`Kembali ke Koleksi ${parentCollection.name}`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
              >
                <ArrowLeft className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {parentCollection.name}
                </span>
              </button>
            )}

            {activeRoomType === "voice" ? (
              <Volume2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : activeRoomType === "collection" ? (
              <FolderKanban className="h-5 w-5 shrink-0 text-amber-300" />
            ) : (
              <Hash className="h-5 w-5 shrink-0 text-[#80848e]" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold text-[#f2f3f5] sm:text-base">
                  {activeChannel?.name ?? "Pilih Ruang"}
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

            {activeRoomType === "chat" && (
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
            )}

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

            {activeChannelId && activeRoomType === "chat" && (
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

            {activeChannel && canManageActiveRoom && (
              <button
                type="button"
                onClick={() => setShowRoomSettingsModal(true)}
                title="Pengaturan Ruang"
                className="rounded-lg p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}

            {activeChannel && activeRoomType === "chat" && (
              <button
                type="button"
                onClick={() =>
                  setRightPanelMode((prev) =>
                    prev === "info" ? "members" : "info",
                  )
                }
                title="Panel Informasi Ruang & Arsip"
                className={`rounded-lg p-2 transition ${rightPanelMode === "info"
                    ? "bg-[#5865f2]/25 text-[#c7d0ff]"
                    : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                  }`}
              >
                <Info className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setRightPanelMode((prev) =>
                  prev === "members" ? "none" : "members",
                )
              }
              title="Tampilkan / sembunyikan daftar anggota"
              className={`hidden rounded-lg p-2 transition xl:inline-flex ${rightPanelMode === "members"
                  ? "bg-white/10 text-white"
                  : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
            >
              <Users className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowRightDrawer(true)}
              title="Buka panel samping"
              className="rounded-lg p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white xl:hidden"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Notifikasi migrasi v2.0 jika belum dijalankan */}
        {!v2Ready && (
          <div className="flex items-start gap-2.5 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="leading-relaxed">
              Jalankan{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-200">
                supabase/migrations/003_v2_communities_and_rooms.sql
              </code>{" "}
              di Supabase SQL Editor untuk mengaktifkan fitur{" "}
              <strong>Multi-Komunitas</strong>, <strong>Sistem Peran</strong>,
              serta <strong>Ruang Suara &amp; Ruang Koleksi</strong>.
            </p>
          </div>
        )}

        {/* Bar Filter Cepat (Khusus Ruang Obrolan) */}
        {activeRoomType === "chat" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#2b2d31]/60 px-4 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterPill
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Semua"
                count={messages.length}
              />
              {activeTabSettings.links && (
                <FilterPill
                  active={activeFilter === "links"}
                  onClick={() => setActiveFilter("links")}
                  icon={<Link2 className="h-3.5 w-3.5" />}
                  label="Tautan"
                  count={filterCounts.links}
                />
              )}
              {activeTabSettings.code && (
                <FilterPill
                  active={activeFilter === "code"}
                  onClick={() => setActiveFilter("code")}
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  label="Kode"
                  count={filterCounts.code}
                />
              )}
              {phase2Ready && (
                <>
                  {activeTabSettings.bookmarks && (
                    <FilterPill
                      active={activeFilter === "bookmarks"}
                      onClick={() => setActiveFilter("bookmarks")}
                      icon={<Bookmark className="h-3.5 w-3.5" />}
                      label="Saku Pesan"
                      count={filterCounts.bookmarks}
                    />
                  )}
                  {activeTabSettings.solutions && (
                    <FilterPill
                      active={activeFilter === "highlights"}
                      onClick={() => setActiveFilter("highlights")}
                      icon={<Award className="h-3.5 w-3.5" />}
                      label="Solusi"
                      count={filterCounts.highlights}
                    />
                  )}
                  {activeTabSettings.solutions &&
                    filterCounts.highlights > 0 && (
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
                placeholder="Cari di ruang ini..."
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

        {/* Konten Utama sesuai Jenis Ruang */}
        {activeRoomType === "voice" && activeChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <Mic className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-[#f2f3f5]">
              Ruang Suara: {activeChannel.name}
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-[#b5bac1]">
              {activeChannel.description ??
                "Ruang panggilan suara real-time dan pesan pendamping."}
            </p>

            <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#949ba4]">
                Sedang di Ruang Suara ({activeChannelViewers.length})
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {activeChannelViewers.map((viewer) => (
                  <div
                    key={viewer.userId}
                    className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#1e1f22] py-1 pr-3 pl-1.5"
                  >
                    <UserAvatar
                      username={viewer.username}
                      avatarUrl={viewer.avatarUrl}
                      size="sm"
                    />
                    <span className="text-xs font-semibold text-[#f2f3f5]">
                      @{viewer.username}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#949ba4]">
                Kontrol mikrofon WebRTC &amp; pesan pendamping siap diaktifkan
                pada <strong>Tahap 3</strong>.
              </p>
            </div>
          </div>
        ) : activeRoomType === "collection" && activeChannel ? (
          <CollectionView
            collection={activeChannel}
            allRooms={channels}
            roomViewerCounts={roomViewerCounts}
            canManageCollection={canManageActiveRoom}
            canCreateChildRoom={canCreateInCollection}
            onSelectRoom={handleSelectChannel}
            onOpenCollectionSettings={() => setShowRoomSettingsModal(true)}
            onCreateRoomInCollection={handleCreateRoomInCollection}
          />
        ) : (
          <>
            {/* Daftar Pesan Ruang Obrolan */}
            <div
              ref={scrollContainerRef}
              onScroll={handleMessagesScroll}
              className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5"
            >
              {!activeChannel ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-[#949ba4]">
                  <Hash className="mb-2 h-10 w-10 text-[#6d737d]" />
                  <p className="text-sm font-medium text-[#dbdee1]">
                    {v2Ready && communities.length === 0
                      ? "Belum tergabung ke Komunitas mana pun"
                      : "Belum ada Ruang tersedia"}
                  </p>
                  <p className="mt-1 text-xs">
                    {v2Ready && communities.length === 0
                      ? "Klik tombol + di rail kiri untuk membuat Komunitas pertamamu, atau masukkan kode undangan."
                      : "Buat Ruang baru dari sidebar kiri."}
                  </p>
                </div>
              ) : isLoadingMessages ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-[#949ba4]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#5865f2]" />
                  <span>Memuat pesan di {activeChannel.name}...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2b2d31] text-[#8ea1e1]">
                    <Hash className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-bold text-[#f2f3f5]">
                    {messages.length === 0
                      ? `Selamat datang di ${activeChannel.name}!`
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
                <div
                  className={
                    density === "compact" ? "space-y-0.5" : "space-y-1.5"
                  }
                >
                  {filteredMessages.map((msg) => (
                    <MessageItem
                      key={msg.id}
                      message={msg}
                      currentUser={effectiveUserForMessage}
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
                    className={`absolute -top-11 z-20 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg transition ${pendingNewMessages > 0
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

            {/* Smart Typing Indicator */}
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
                disabledReason={composerDisabledReason}
                onCancelReply={() => setReplyTarget(null)}
                onSendMessage={handleSendMessage}
                onSendPoll={handleSendPoll}
                onTyping={handleBroadcastTyping}
              />
            )}
          </>
        )}
      </main>

        {/* Panel Samping Kanan (Informasi Ruang atau Daftar Anggota) */ }
      {rightPanelMode === "info" && activeChannel && activeRoomType === "chat" ? (
        <div className="hidden xl:flex">
          <RoomInfoPanel
            channel={activeChannel}
            messages={messages}
            phase2Ready={phase2Ready}
            onJumpToMessage={handleJumpToMessage}
            onExportSolutionsMarkdown={handleExportHighlightsMarkdown}
            copiedSolutions={copiedHighlights}
            onClose={() => setRightPanelMode("members")}
          />
        </div>
      ) : (
        rightPanelMode === "members" && (
          <div className="hidden xl:flex">
            <MemberSidebar
              members={members}
              onlineUsers={onlineUsers}
              currentUserId={currentUser.id}
            />
          </div>
        )
      )}

      {showRightDrawer && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <button
            type="button"
            aria-label="Tutup panel samping"
            onClick={() => setShowRightDrawer(false)}
            className="flex-1 bg-black/60"
          />
          <div className="relative z-10 flex h-full">
            {rightPanelMode === "info" &&
              activeChannel &&
              activeRoomType === "chat" ? (
              <RoomInfoPanel
                channel={activeChannel}
                messages={messages}
                phase2Ready={phase2Ready}
                onJumpToMessage={(id) => {
                  setShowRightDrawer(false);
                  handleJumpToMessage(id);
                }}
                onExportSolutionsMarkdown={handleExportHighlightsMarkdown}
                copiedSolutions={copiedHighlights}
                onClose={() => setShowRightDrawer(false)}
              />
            ) : (
              <MemberSidebar
                members={members}
                onlineUsers={onlineUsers}
                currentUserId={currentUser.id}
                onCloseMobile={() => setShowRightDrawer(false)}
              />
            )}
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

      {/* Modal Kelola Peran Komunitas */}
      {activeCommunity && (
        <CommunityRolesModal
          isOpen={showRolesModal}
          communityName={activeCommunity.name}
          roles={communityRoles}
          members={members}
          currentUserId={currentUser.id}
          onClose={() => setShowRolesModal(false)}
          onCreateRole={handleCreateRole}
          onUpdateRolePermission={handleUpdateRolePermission}
          onDeleteRole={handleDeleteRole}
          onAssignMemberRole={handleAssignMemberRole}
        />
      )}

      {/* Modal Pengaturan Ruang */}
      {activeChannel && (
        <RoomSettingsModal
          key={activeChannel.id}
          isOpen={showRoomSettingsModal}
          channel={activeChannel}
          roles={communityRoles}
          members={members}
          v2Ready={v2Ready}
          onClose={() => setShowRoomSettingsModal(false)}
          onSaved={(updated) => {
            setChannels((prev) =>
              prev
                .map((c) => (c.id === updated.id ? updated : c))
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          }}
        />
      )}
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

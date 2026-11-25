"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Headphones,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  SendHorizontal,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatMessageTime } from "@/lib/message-format";
import { createClient } from "@/lib/supabase/client";
import type { ActiveTyper, ChatMessage, TypingMode } from "@/types/chat";
import type { Channel, Profile } from "@/types/database";
import { RichMessageContent } from "./RichMessageContent";
import { TypingIndicator } from "./TypingIndicator";
import { UserAvatar } from "./UserAvatar";

interface VoiceRoomViewProps {
  channel: Channel;
  currentUser: Profile;
  canModerate: boolean;
  messages: ChatMessage[];
  typingUsers: ActiveTyper[];
  isSending: boolean;
  composerDisabledReason?: string | null;
  onSendTextMessage: (content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onTyping?: (mode: TypingMode) => void;
}

type VoiceParticipant = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  joinedAt: string;
};

type SignalPayload = {
  fromUserId: string;
  toUserId: string;
  type: "offer" | "answer" | "ice-candidate";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type ForceMutePayload = {
  targetUserId: string;
  byUsername: string;
};

type AudioElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function RemoteAudioPlayer({
  stream,
  muted,
  sinkId,
}: {
  stream: MediaStream;
  muted: boolean;
  sinkId: string;
}) {
  const audioRef = useRef<AudioElementWithSinkId | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) {
      return;
    }
    el.srcObject = stream;
    void el.play().catch(() => {
      // Browser mungkin menunda autoplay hingga interaksi berikutnya
    });

    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) {
      return;
    }
    el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !sinkId || typeof el.setSinkId !== "function") {
      return;
    }
    void el.setSinkId(sinkId).catch(() => {
      // Abaikan jika browser menolak ganti perangkat output
    });
  }, [sinkId]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

export function VoiceRoomView({
  channel,
  currentUser,
  canModerate,
  messages,
  typingUsers,
  isSending,
  composerDisabledReason,
  onSendTextMessage,
  onDeleteMessage,
  onTyping,
}: VoiceRoomViewProps) {
  const supabase = useMemo(() => createClient(), []);

  // State Panggilan Suara
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");

  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [locallyMutedUsers, setLocallyMutedUsers] = useState<
    Record<string, boolean>
  >({});

  // Pengaturan Perangkat Audio
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState("");
  const [selectedOutputId, setSelectedOutputId] = useState("");

  // State Panel Pesan Pendamping (Khusus Teks)
  const [mobileTab, setMobileTab] = useState<"voice" | "chat">("voice");
  const [showCompanionDesktop, setShowCompanionDesktop] = useState(true);
  const [textInput, setTextInput] = useState("");

  // Refs WebRTC & Signaling
  const voiceChannelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isMutedRef = useRef<boolean>(isMuted);
  const joinedAtRef = useRef<string>("");
  const lastTypingEmitRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const refreshAudioDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    } catch {
      // Abaikan jika browser tidak mengizinkan enumerasi perangkat
    }
  }, []);

  const closePeerConnection = useCallback((remoteUserId: string) => {
    const pc = peersRef.current.get(remoteUserId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(remoteUserId);
    }
    pendingIceRef.current.delete(remoteUserId);
    setRemoteStreams((prev) => {
      if (!prev[remoteUserId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[remoteUserId];
      return next;
    });
  }, []);

  const leaveVoiceCall = useCallback(async () => {
    for (const remoteId of Array.from(peersRef.current.keys())) {
      closePeerConnection(remoteId);
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }

    const activeVoiceChannel = voiceChannelRef.current;
    voiceChannelRef.current = null;

    if (activeVoiceChannel) {
      try {
        await activeVoiceChannel.untrack();
      } catch {
        // Abaikan jika sudah terputus
      }
      await supabase.removeChannel(activeVoiceChannel);
    }

    setIsJoined(false);
    setIsJoining(false);
    setIsMuted(false);
    setParticipants([]);
    setRemoteStreams({});
  }, [closePeerConnection, supabase]);

  // Bersihkan seluruh koneksi saat komponen unmount atau berpindah Ruang Suara
  useEffect(() => {
    const peers = peersRef.current;

    return () => {
      for (const pc of peers.values()) {
        pc.close();
      }
      peers.clear();

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }

      if (voiceChannelRef.current) {
        void supabase.removeChannel(voiceChannelRef.current);
        voiceChannelRef.current = null;
      }
    };
  }, [supabase]);

  const getOrCreatePeerConnection = useCallback(
    (remoteUserId: string, signalingChannel: RealtimeChannel) => {
      const existing = peersRef.current.get(remoteUserId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        void signalingChannel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            fromUserId: currentUser.id,
            toUserId: remoteUserId,
            type: "ice-candidate",
            candidate: event.candidate.toJSON(),
          } satisfies SignalPayload,
        });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStreams((prev) => ({
            ...prev,
            [remoteUserId]: stream,
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          closePeerConnection(remoteUserId);
        }
      };

      peersRef.current.set(remoteUserId, pc);
      return pc;
    },
    [closePeerConnection, currentUser.id],
  );

  async function handleJoinVoice() {
    if (isJoining || isJoined) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setVoiceError(
        "Browser ini tidak mendukung WebRTC audio. Gunakan Chrome, Edge, atau Firefox versi terbaru melalui HTTPS/localhost.",
      );
      return;
    }

    setVoiceError("");
    setVoiceNotice("");
    setIsJoining(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputId
          ? { deviceId: { exact: selectedInputId } }
          : true,
        video: false,
      });

      localStreamRef.current = stream;
      await refreshAudioDevices();

      const voiceChannel = supabase.channel(`bertemanyuk:voice:${channel.id}`, {
        config: {
          presence: { key: currentUser.id },
          broadcast: { self: false },
        },
      });

      voiceChannelRef.current = voiceChannel;
      joinedAtRef.current = new Date().toISOString();

      voiceChannel.on("presence", { event: "sync" }, () => {
        const state = voiceChannel.presenceState<VoiceParticipant>();
        const activeList: VoiceParticipant[] = [];
        const activeIds = new Set<string>();

        for (const [key, entries] of Object.entries(state)) {
          const latest = entries[entries.length - 1];
          if (latest) {
            const uid = latest.userId || key;
            activeIds.add(uid);
            activeList.push({ ...latest, userId: uid });
          }
        }

        setParticipants(activeList);

        // Tutup koneksi peer yang sudah keluar dari ruang suara
        for (const remoteId of Array.from(peersRef.current.keys())) {
          if (!activeIds.has(remoteId)) {
            closePeerConnection(remoteId);
          }
        }

        // Aturan anti-glare deterministik: ID lebih kecil mengirim offer
        for (const participant of activeList) {
          if (
            participant.userId !== currentUser.id &&
            currentUser.id < participant.userId &&
            !peersRef.current.has(participant.userId)
          ) {
            void (async () => {
              const pc = getOrCreatePeerConnection(
                participant.userId,
                voiceChannel,
              );
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await voiceChannel.send({
                type: "broadcast",
                event: "signal",
                payload: {
                  fromUserId: currentUser.id,
                  toUserId: participant.userId,
                  type: "offer",
                  sdp: pc.localDescription ?? offer,
                } satisfies SignalPayload,
              });
            })();
          }
        }
      });

      voiceChannel.on("broadcast", { event: "signal" }, ({ payload }) => {
        const data = payload as SignalPayload | undefined;
        if (!data || data.toUserId !== currentUser.id) {
          return;
        }

        void (async () => {
          const pc = getOrCreatePeerConnection(data.fromUserId, voiceChannel);

          if (data.type === "offer" && data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const queued = pendingIceRef.current.get(data.fromUserId) ?? [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingIceRef.current.delete(data.fromUserId);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await voiceChannel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                fromUserId: currentUser.id,
                toUserId: data.fromUserId,
                type: "answer",
                sdp: pc.localDescription ?? answer,
              } satisfies SignalPayload,
            });
          } else if (data.type === "answer" && data.sdp) {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.sdp),
              );
              const queued = pendingIceRef.current.get(data.fromUserId) ?? [];
              for (const cand of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
              pendingIceRef.current.delete(data.fromUserId);
            }
          } else if (data.type === "ice-candidate" && data.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
              const list = pendingIceRef.current.get(data.fromUserId) ?? [];
              list.push(data.candidate);
              pendingIceRef.current.set(data.fromUserId, list);
            }
          }
        })();
      });

      voiceChannel.on("broadcast", { event: "force-mute" }, ({ payload }) => {
        const data = payload as ForceMutePayload | undefined;
        if (!data || data.targetUserId !== currentUser.id) {
          return;
        }

        if (localStreamRef.current) {
          for (const track of localStreamRef.current.getAudioTracks()) {
            track.enabled = false;
          }
        }
        setIsMuted(true);
        setVoiceNotice(
          `Mikrofon kamu dibisukan oleh @${data.byUsername}.`,
        );

        void voiceChannel.track({
          userId: currentUser.id,
          username: currentUser.username,
          avatarUrl: currentUser.avatar_url,
          isMuted: true,
          joinedAt: joinedAtRef.current,
        } satisfies VoiceParticipant);
      });

      voiceChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await voiceChannel.track({
            userId: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatar_url,
            isMuted: isMutedRef.current,
            joinedAt: joinedAtRef.current,
          } satisfies VoiceParticipant);
          setIsJoined(true);
          setIsJoining(false);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setVoiceError("Gagal terhubung ke saluran sinyal Ruang Suara.");
          await leaveVoiceCall();
        }
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengakses mikrofon.";
      if (msg.toLowerCase().includes("permission") || msg.includes("NotAllowed")) {
        setVoiceError(
          "Izin mikrofon ditolak browser. Izinkan akses mikrofon di bilah alamat lalu coba lagi.",
        );
      } else if (msg.includes("NotFound")) {
        setVoiceError(
          "Perangkat mikrofon tidak ditemukan pada perangkat Anda.",
        );
      } else {
        setVoiceError(msg);
      }
      await leaveVoiceCall();
    }
  }

  async function handleToggleSelfMute() {
    const nextMuted = !isMuted;

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = !nextMuted;
      }
    }

    setIsMuted(nextMuted);
    setVoiceNotice("");

    if (voiceChannelRef.current && isJoined) {
      await voiceChannelRef.current.track({
        userId: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatar_url,
        isMuted: nextMuted,
        joinedAt: joinedAtRef.current,
      } satisfies VoiceParticipant);
    }
  }

  async function handleSwitchInputDevice(deviceId: string) {
    setSelectedInputId(deviceId);
    if (!isJoined || !localStreamRef.current) {
      return;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });

      const [newTrack] = nextStream.getAudioTracks();
      if (!newTrack) {
        return;
      }

      newTrack.enabled = !isMuted;

      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }

      for (const oldTrack of localStreamRef.current.getTracks()) {
        oldTrack.stop();
      }
      localStreamRef.current = nextStream;
    } catch {
      setVoiceError("Gagal mengganti perangkat mikrofon.");
    }
  }

  function handleToggleLocalMuteUser(targetUserId: string) {
    setLocallyMutedUsers((prev) => ({
      ...prev,
      [targetUserId]: !prev[targetUserId],
    }));
  }

  async function handleForceMuteUser(targetUserId: string) {
    if (!canModerate || !voiceChannelRef.current) {
      return;
    }

    await voiceChannelRef.current.send({
      type: "broadcast",
      event: "force-mute",
      payload: {
        targetUserId,
        byUsername: currentUser.username,
      } satisfies ForceMutePayload,
    });
  }

  async function submitCompanionText() {
    const trimmed = textInput.trim();
    if (!trimmed || isSending) {
      return;
    }
    setTextInput("");
    await onSendTextMessage(trimmed);
  }

  function handleCompanionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCompanionText();
  }

  function handleCompanionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCompanionText();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Elemen <audio> tersembunyi untuk setiap stream peserta remote */}
      {Object.entries(remoteStreams).map(([remoteId, stream]) => (
        <RemoteAudioPlayer
          key={remoteId}
          stream={stream}
          muted={Boolean(locallyMutedUsers[remoteId])}
          sinkId={selectedOutputId}
        />
      ))}

      {/* Bar Tab Mobile (Panggilan Suara vs Pesan Pendamping) */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#2b2d31] px-4 py-2 lg:hidden">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMobileTab("voice")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              mobileTab === "voice"
                ? "bg-[#5865f2] text-white"
                : "text-[#b5bac1] hover:bg-white/10"
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Panggilan ({participants.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              mobileTab === "chat"
                ? "bg-[#5865f2] text-white"
                : "text-[#b5bac1] hover:bg-white/10"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Pesan ({messages.length})</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Stage Utama Ruang Suara */}
        <section
          className={`flex min-w-0 flex-1 flex-col justify-between bg-[#2b2d31]/40 p-5 ${
            mobileTab === "voice" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Header Stage & Tombol Toggle Pesan Pendamping Desktop */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    isJoined
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-[#b5bac1]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isJoined ? "animate-pulse bg-emerald-400" : "bg-[#949ba4]"
                    }`}
                  />
                  {isJoined
                    ? "Terhubung ke Audio WebRTC"
                    : "Belum Bergabung Panggilan"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#949ba4]">
                {channel.description ||
                  "Ruang panggilan suara real-time dan pesan teks pendamping."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCompanionDesktop((prev) => !prev)}
              className={`hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition lg:inline-flex ${
                showCompanionDesktop
                  ? "border-[#5865f2]/40 bg-[#5865f2]/15 text-[#c7d0ff]"
                  : "border-white/10 bg-[#2b2d31] text-[#b5bac1] hover:text-white"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Pesan Pendamping ({messages.length})</span>
            </button>
          </div>

          {/* Notifikasi Error / Peringatan Mute */}
          {(voiceError || voiceNotice) && (
            <div className="my-3 space-y-2">
              {voiceError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
                >
                  <span>{voiceError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceError("")}
                    className="text-rose-300 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {voiceNotice && (
                <div
                  role="status"
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200"
                >
                  <span>{voiceNotice}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceNotice("")}
                    className="text-amber-300 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid Peserta Panggilan */}
          <div className="my-4 flex flex-1 items-center justify-center overflow-y-auto">
            {!isJoined ? (
              <div className="max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-7 text-center shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <Headphones className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-bold text-[#f2f3f5]">
                  Siap bergabung ke {channel.name}?
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#b5bac1]">
                  Suara dikirim langsung secara peer-to-peer lewat WebRTC. Kamu
                  juga tetap bisa berkirim pesan teks di panel Pesan Pendamping.
                </p>

                <button
                  type="button"
                  disabled={isJoining}
                  onClick={() => void handleJoinVoice()}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {isJoining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                  <span>
                    {isJoining ? "Menyambungkan..." : "Gabung Ruang Suara"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2 md:grid-cols-3">
                {participants.map((p) => {
                  const isSelf = p.userId === currentUser.id;
                  const isLocallyMuted = Boolean(locallyMutedUsers[p.userId]);
                  const hasRemoteAudio = Boolean(remoteStreams[p.userId]);

                  return (
                    <div
                      key={p.userId}
                      className={`flex flex-col items-center justify-between rounded-2xl border p-5 text-center transition ${
                        !p.isMuted
                          ? "border-emerald-400/50 bg-[#2b2d31] shadow-lg shadow-emerald-500/5"
                          : "border-white/10 bg-[#232428]"
                      }`}
                    >
                      <div className="relative mb-3">
                        <UserAvatar
                          username={p.username}
                          avatarUrl={p.avatarUrl}
                          size="lg"
                        />
                        <span
                          title={
                            p.isMuted ? "Mikrofon dibisukan" : "Mikrofon aktif"
                          }
                          className={`absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#2b2d31] ${
                            p.isMuted
                              ? "bg-rose-500 text-white"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          {p.isMuted ? (
                            <MicOff className="h-3 w-3" />
                          ) : (
                            <Mic className="h-3 w-3" />
                          )}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-[#f2f3f5]">
                          @{p.username}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#949ba4]">
                          {isSelf
                            ? isMuted
                              ? "Kamu (Dibisukan)"
                              : "Kamu (Bicara)"
                            : isLocallyMuted
                              ? "Dibisukan untukmu"
                              : hasRemoteAudio
                                ? p.isMuted
                                  ? "Mikrofon mati"
                                  : "Terhubung"
                                : "Menghubungkan audio..."}
                        </p>
                      </div>

                      {!isSelf && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleLocalMuteUser(p.userId)}
                            title={
                              isLocallyMuted
                                ? "Dengarkan kembali peserta ini"
                                : "Bisukan peserta ini untukmu"
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                              isLocallyMuted
                                ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                                : "border-white/10 bg-[#1e1f22] text-[#b5bac1] hover:text-white"
                            }`}
                          >
                            {isLocallyMuted ? (
                              <>
                                <VolumeX className="h-3 w-3" />
                                <span>Unmute</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                <span>Bisukan</span>
                              </>
                            )}
                          </button>

                          {canModerate && !p.isMuted && (
                            <button
                              type="button"
                              onClick={() => void handleForceMuteUser(p.userId)}
                              title="Bisukan mikrofon peserta ini (Pengurus/Pemilik)"
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-500/20"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              <span>Mute Mic</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Pengaturan Perangkat Input & Output */}
          {showAudioSettings && (
            <div className="mb-3 rounded-2xl border border-white/10 bg-[#232428] p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#f2f3f5]">
                  Pengaturan Perangkat Ruang Suara
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAudioSettings(false)}
                  className="rounded p-1 text-[#949ba4] hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="voice-input-device"
                    className="block text-[11px] font-semibold text-[#b5bac1]"
                  >
                    Perangkat Input (Mikrofon)
                  </label>
                  <select
                    id="voice-input-device"
                    value={selectedInputId}
                    onChange={(e) =>
                      void handleSwitchInputDevice(e.target.value)
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="">Mikrofon Bawaan Sistem</option>
                    {audioInputs.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId}>
                        {device.label || `Mikrofon ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="voice-output-device"
                    className="block text-[11px] font-semibold text-[#b5bac1]"
                  >
                    Perangkat Output (Speaker / Headset)
                  </label>
                  <select
                    id="voice-output-device"
                    value={selectedOutputId}
                    onChange={(e) => setSelectedOutputId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="">Speaker Bawaan Sistem</option>
                    {audioOutputs.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId}>
                        {device.label || `Speaker ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bilah Kontrol Utama Ruang Suara */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-[#232428] px-4 py-3">
            {!isJoined ? (
              <button
                type="button"
                disabled={isJoining}
                onClick={() => void handleJoinVoice()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {isJoining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span>Nyalakan Mikrofon &amp; Gabung</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleToggleSelfMute()}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isMuted
                      ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30"
                      : "bg-[#5865f2] text-white hover:bg-[#4752c4]"
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span>Nyalakan Mikrofon</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>Bisukan Saya</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void leaveVoiceCall()}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  <PhoneOff className="h-4 w-4" />
                  <span>Keluar Panggilan</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                void refreshAudioDevices();
                setShowAudioSettings((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                showAudioSettings
                  ? "border-[#5865f2] bg-[#5865f2]/20 text-[#c7d0ff]"
                  : "border-white/10 bg-[#2b2d31] text-[#dbdee1] hover:bg-white/10"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Pengaturan Suara</span>
            </button>
          </div>
        </section>

        {/* Panel Pesan Pendamping (Khusus Teks, Tanpa Gambar/Video) */}
        <aside
          className={`flex h-full flex-col border-l border-white/10 bg-[#313338] ${
            mobileTab === "chat"
              ? "w-full lg:w-80 xl:w-96"
              : showCompanionDesktop
                ? "hidden lg:flex lg:w-80 xl:w-96"
                : "hidden"
          }`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#8ea1e1]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#f2f3f5]">
                Pesan Pendamping
              </h3>
            </div>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-[#949ba4]">
              Teks saja
            </span>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-xs leading-relaxed text-[#949ba4]">
                Belum ada pesan pendamping. Bagikan tautan atau catatan teks
                selama panggilan suara berlangsung.
              </p>
            ) : (
              messages.map((msg) => {
                const canDelete = msg.user_id === currentUser.id || canModerate;
                return (
                  <div
                    key={msg.id}
                    className="group rounded-xl border border-white/5 bg-[#2b2d31]/70 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          username={msg.author?.username ?? "anggota"}
                          avatarUrl={msg.author?.avatar_url ?? null}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[#f2f3f5]">
                            @{msg.author?.username ?? "anggota"}
                          </p>
                          <p className="text-[10px] text-[#949ba4]">
                            {formatMessageTime(msg.created_at)}
                          </p>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          title="Hapus pesan"
                          className="hidden rounded p-1 text-[#949ba4] hover:bg-rose-500/20 hover:text-rose-300 group-hover:inline-flex"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-1.5 pl-9">
                      <RichMessageContent
                        content={msg.content}
                        currentUsername={currentUser.username}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <TypingIndicator typers={typingUsers} />

          <div className="border-t border-white/10 p-3">
            {composerDisabledReason ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#2b2d31] px-3 py-2.5 text-xs text-[#949ba4]">
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span>{composerDisabledReason}</span>
              </div>
            ) : (
              <form
                onSubmit={handleCompanionSubmit}
                className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#383a40] p-2 focus-within:border-[#5865f2]/60"
              >
                <textarea
                  rows={1}
                  value={textInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTextInput(next);
                    if (onTyping && next.trim()) {
                      const now = Date.now();
                      if (now - lastTypingEmitRef.current >= 1200) {
                        lastTypingEmitRef.current = now;
                        onTyping("text");
                      }
                    }
                  }}
                  onKeyDown={handleCompanionKeyDown}
                  disabled={isSending}
                  placeholder="Kirim pesan teks pendamping..."
                  className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-xs text-[#f2f3f5] placeholder:text-[#878c96] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSending || !textInput.trim()}
                  aria-label="Kirim pesan pendamping"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865f2] text-white transition hover:bg-[#4752c4] disabled:opacity-40"
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-3.5 w-3.5" />
                  )}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

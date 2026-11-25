"use client";

import { useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  FolderKanban,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Settings,
  Shield,
  ShieldCheck,
  SmilePlus,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { normalizeChannelName } from "@/lib/message-format";
import { VIBE_PRESETS } from "@/lib/sound";
import type {
  Channel,
  Community,
  CommunityRole,
  Profile,
  RoomType,
} from "@/types/database";
import { UserAvatar } from "./UserAvatar";

interface ChannelSidebarProps {
  activeCommunity: Community | null;
  currentCommunityRole: CommunityRole | null;
  channels: Channel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  roomViewerCounts: Record<string, number>;
  currentUser: Profile;
  currentVibe: string | null;
  v2Ready: boolean;
  onChangeVibe: (vibe: string | null) => void;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (
    name: string,
    description: string,
    roomType: RoomType,
  ) => Promise<string | null>;
  onUpdateChannel: (
    channelId: string,
    name: string,
    description: string,
  ) => Promise<string | null>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onOpenRolesModal: () => void;
  onOpenProfile: () => void;
  onCloseMobile?: () => void;
}

const ROOM_TYPE_META: Record<
  RoomType,
  { label: string; shortLabel: string; icon: typeof MessageSquare }
> = {
  chat: {
    label: "Ruang Obrolan",
    shortLabel: "Obrolan",
    icon: MessageSquare,
  },
  voice: {
    label: "Ruang Suara",
    shortLabel: "Suara",
    icon: Volume2,
  },
  collection: {
    label: "Ruang Koleksi",
    shortLabel: "Koleksi",
    icon: FolderKanban,
  },
};

export function ChannelSidebar({
  activeCommunity,
  currentCommunityRole,
  channels,
  activeChannelId,
  unreadCounts,
  roomViewerCounts,
  currentUser,
  currentVibe,
  v2Ready,
  onChangeVibe,
  onSelectChannel,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onOpenRolesModal,
  onOpenProfile,
  onCloseMobile,
}: ChannelSidebarProps) {
  const isSystemAdmin = currentUser.role === "ADMIN";
  const canManageRoles = Boolean(
    v2Ready &&
      (currentCommunityRole?.can_manage_roles ||
        activeCommunity?.owner_id === currentUser.id),
  );
  const canCreateRoom =
    isSystemAdmin ||
    Boolean(currentCommunityRole?.can_create_room) ||
    activeCommunity?.owner_id === currentUser.id;
  const canUpdateRoom =
    isSystemAdmin ||
    Boolean(currentCommunityRole?.can_update_room) ||
    activeCommunity?.owner_id === currentUser.id;
  const canDeleteRoom =
    isSystemAdmin ||
    Boolean(currentCommunityRole?.can_delete_room) ||
    activeCommunity?.owner_id === currentUser.id;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomType, setNewRoomType] = useState<RoomType>("chat");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showVibePicker, setShowVibePicker] = useState(false);
  const [customVibe, setCustomVibe] = useState(currentVibe ?? "");

  const chatRooms = channels.filter(
    (c) => (c.room_type ?? "chat") === "chat" && !c.parent_collection_id,
  );
  const voiceRooms = channels.filter(
    (c) => c.room_type === "voice" && !c.parent_collection_id,
  );
  const collectionRooms = channels.filter((c) => c.room_type === "collection");

  async function handleCopyInviteCode() {
    if (!activeCommunity?.invite_code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(activeCommunity.invite_code);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      // Abaikan jika clipboard ditolak browser
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    const cleaned = normalizeChannelName(name);
    if (cleaned.length < 2) {
      setFormError("Nama ruang minimal 2 karakter (huruf/angka).");
      return;
    }

    setFormError("");
    setIsCreating(true);
    const error = await onCreateChannel(cleaned, description.trim(), newRoomType);
    setIsCreating(false);

    if (error) {
      setFormError(error);
      return;
    }

    setName("");
    setDescription("");
    setNewRoomType("chat");
    setShowCreateForm(false);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingChannelId || isUpdating) {
      return;
    }

    const cleaned = normalizeChannelName(editName);
    if (cleaned.length < 2) {
      setEditError("Nama ruang minimal 2 karakter (huruf/angka).");
      return;
    }

    setEditError("");
    setIsUpdating(true);
    const error = await onUpdateChannel(
      editingChannelId,
      cleaned,
      editDescription.trim(),
    );
    setIsUpdating(false);

    if (error) {
      setEditError(error);
      return;
    }

    setEditingChannelId(null);
  }

  function handleCustomVibeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = customVibe.trim().slice(0, 36);
    onChangeVibe(cleaned || null);
    setShowVibePicker(false);
  }

  function renderRoomRow(channel: Channel) {
    const isActive = channel.id === activeChannelId;
    const unread = unreadCounts[channel.id] ?? 0;
    const roomType: RoomType = channel.room_type ?? "chat";
    const Icon = ROOM_TYPE_META[roomType].icon;
    const viewerCount = roomViewerCounts[channel.id] ?? 0;

    if (canUpdateRoom && editingChannelId === channel.id) {
      return (
        <form
          key={channel.id}
          onSubmit={handleEditSubmit}
          className="my-1 space-y-2 rounded-xl border border-[#5865f2]/40 bg-[#1e1f22] p-2.5"
        >
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="nama-ruang"
            className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
          />
          <input
            type="text"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Deskripsi ruang (opsional)"
            className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
          />
          {editError && <p className="text-[11px] text-rose-300">{editError}</p>}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditingChannelId(null)}
              className="rounded-md px-2 py-1 text-[11px] text-[#949ba4] hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-1 rounded-md bg-[#5865f2] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
            >
              {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Simpan</span>
            </button>
          </div>
        </form>
      );
    }

    return (
      <div
        key={channel.id}
        className={`group flex items-center justify-between rounded-lg transition ${
          isActive
            ? "bg-[#404249] text-white"
            : unread > 0
              ? "bg-white/[0.04] text-[#f2f3f5] hover:bg-[#35373c]"
              : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onSelectChannel(channel.id);
            onCloseMobile?.();
          }}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-sm font-medium"
        >
          <Icon
            className={`h-4 w-4 shrink-0 ${
              isActive || unread > 0
                ? "text-[#f2f3f5]"
                : roomType === "voice"
                  ? "text-emerald-400/80"
                  : roomType === "collection"
                    ? "text-amber-300/80"
                    : "text-[#80848e]"
            }`}
          />
          <span
            className={`truncate ${unread > 0 && !isActive ? "font-semibold" : ""}`}
          >
            {channel.name}
          </span>
        </button>

        <div className="mr-1.5 flex items-center gap-0.5">
          {roomType === "voice" && viewerCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              {viewerCount}
            </span>
          )}

          {unread > 0 && !isActive && (
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}

          {canUpdateRoom && (
            <button
              type="button"
              onClick={() => {
                setEditingChannelId(channel.id);
                setEditName(channel.name);
                setEditDescription(channel.description ?? "");
                setEditError("");
              }}
              title={`Ubah ${channel.name}`}
              className="hidden rounded p-1 text-[#949ba4] hover:bg-white/10 hover:text-white group-hover:inline-flex"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {canDeleteRoom && channels.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Hapus ruang "${channel.name}" beserta seluruh isinya?`,
                  )
                ) {
                  void onDeleteChannel(channel.id);
                }
              }}
              title={`Hapus ${channel.name}`}
              className="hidden rounded p-1 text-[#949ba4] hover:bg-rose-500/20 hover:text-rose-300 group-hover:inline-flex"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-[#2b2d31]">
      {/* Header Komunitas Aktif */}
      <div className="border-b border-white/10 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight text-[#f2f3f5]">
              {activeCommunity?.name ?? "BertemanYuk"}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {currentCommunityRole ? (
                <span className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c7d0ff]">
                  {currentCommunityRole.name}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[#949ba4]">
                  Komunitas
                </span>
              )}

              {activeCommunity?.invite_code && (
                <button
                  type="button"
                  onClick={() => void handleCopyInviteCode()}
                  title="Salin kode undangan komunitas"
                  className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                      <span className="text-emerald-300">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-2.5 w-2.5" />
                      <span>{activeCommunity.invite_code}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {canManageRoles && (
              <button
                type="button"
                onClick={onOpenRolesModal}
                title="Kelola Peran & Hak Akses Komunitas"
                className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup daftar ruang"
                className="rounded-lg p-1 text-[#949ba4] hover:bg-white/10 hover:text-white lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Daftar Ruang (3 Jenis Ruang) */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        {canCreateRoom && (
          <div className="flex items-center justify-between px-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
              Daftar Ruang
            </span>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm((prev) => !prev);
                setFormError("");
              }}
              title="Buat Ruang Baru"
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold text-[#dbdee1] transition hover:bg-[#5865f2] hover:text-white"
            >
              <Plus className="h-3 w-3" />
              <span>Ruang</span>
            </button>
          </div>
        )}

        {canCreateRoom && showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            className="space-y-2 rounded-xl border border-white/10 bg-[#1e1f22] p-2.5"
          >
            {v2Ready && (
              <div className="grid grid-cols-3 gap-1">
                {(["chat", "voice", "collection"] as RoomType[]).map((type) => {
                  const meta = ROOM_TYPE_META[type];
                  const selected = newRoomType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewRoomType(type)}
                      className={`rounded-md px-1.5 py-1 text-[10px] font-semibold transition ${
                        selected
                          ? "bg-[#5865f2] text-white"
                          : "bg-[#2b2d31] text-[#949ba4] hover:text-white"
                      }`}
                    >
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`nama-${ROOM_TYPE_META[newRoomType].shortLabel.toLowerCase()}`}
              className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat (opsional)"
              className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
            />
            {formError && (
              <p className="text-[11px] text-rose-300">{formError}</p>
            )}
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md px-2 py-1 text-[11px] text-[#949ba4] hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center gap-1 rounded-md bg-[#5865f2] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
              >
                {isCreating && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Buat</span>
              </button>
            </div>
          </form>
        )}

        {/* Bagian 1: Ruang Obrolan */}
        <section>
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
            Ruang Obrolan ({chatRooms.length})
          </p>
          <nav className="space-y-0.5" aria-label="Ruang Obrolan">
            {chatRooms.map((room) => renderRoomRow(room))}
          </nav>
        </section>

        {/* Bagian 2: Ruang Suara */}
        {(voiceRooms.length > 0 || v2Ready) && (
          <section>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
              Ruang Suara ({voiceRooms.length})
            </p>
            {voiceRooms.length === 0 ? (
              <p className="px-2 text-[11px] text-[#6d737d]">
                Belum ada ruang suara.
              </p>
            ) : (
              <nav className="space-y-0.5" aria-label="Ruang Suara">
                {voiceRooms.map((room) => renderRoomRow(room))}
              </nav>
            )}
          </section>
        )}

        {/* Bagian 3: Ruang Koleksi */}
        {collectionRooms.length > 0 && (
          <section>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
              Ruang Koleksi ({collectionRooms.length})
            </p>
            <nav className="space-y-0.5" aria-label="Ruang Koleksi">
              {collectionRooms.map((room) => renderRoomRow(room))}
            </nav>
          </section>
        )}
      </div>

      {/* Picker Vibe Status (Presence) */}
      <div className="border-t border-white/10 bg-[#232428] px-2.5 pt-2.5">
        {showVibePicker ? (
          <div className="mb-2 space-y-2 rounded-xl border border-white/10 bg-[#1e1f22] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8ea1e1]">
                Pasang Vibe Status
              </span>
              <button
                type="button"
                onClick={() => setShowVibePicker(false)}
                className="text-[#949ba4] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {VIBE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChangeVibe(preset);
                    setCustomVibe(preset);
                    setShowVibePicker(false);
                  }}
                  className={`rounded-md px-2 py-1 text-[11px] transition ${
                    currentVibe === preset
                      ? "bg-[#5865f2] text-white"
                      : "bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <form onSubmit={handleCustomVibeSubmit} className="flex gap-1.5">
              <input
                type="text"
                maxLength={36}
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                placeholder="Atau ketik status sendiri..."
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#2b2d31] px-2 py-1 text-[11px] text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-md bg-[#5865f2] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#4752c4]"
              >
                Simpan
              </button>
            </form>

            {currentVibe && (
              <button
                type="button"
                onClick={() => {
                  onChangeVibe(null);
                  setCustomVibe("");
                  setShowVibePicker(false);
                }}
                className="w-full rounded-md py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
              >
                Hapus Vibe Status
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCustomVibe(currentVibe ?? "");
              setShowVibePicker(true);
            }}
            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-white/5 bg-[#1e1f22]/70 px-2.5 py-1.5 text-left text-[11px] text-[#b5bac1] transition hover:border-white/15 hover:text-white"
          >
            <SmilePlus className="h-3.5 w-3.5 shrink-0 text-[#8ea1e1]" />
            <span className="truncate">
              {currentVibe ? currentVibe : "Pasang Vibe Status..."}
            </span>
          </button>
        )}
      </div>

      {/* Footer Profil Pengguna */}
      <div className="bg-[#232428] px-2.5 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition hover:bg-white/5"
            title="Edit profil"
          >
            <div className="relative">
              <UserAvatar
                username={currentUser.username}
                avatarUrl={currentUser.avatar_url}
                size="sm"
              />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#232428] bg-emerald-400"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-xs font-semibold text-[#f2f3f5]">
                  @{currentUser.username}
                </p>
                {isSystemAdmin && (
                  <Shield className="h-3 w-3 shrink-0 text-amber-300" />
                )}
              </div>
              <p className="truncate text-[10px] text-emerald-300/90">
                Online • {isSystemAdmin ? "Admin Sistem" : "Pengguna"}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onOpenProfile}
              title="Pengaturan profil"
              className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Keluar"
                className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-rose-500/20 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}

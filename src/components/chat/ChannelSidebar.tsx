"use client";

import { useState, type FormEvent } from "react";
import {
  Hash,
  Loader2,
  LogOut,
  MessageSquareCode,
  Pencil,
  Plus,
  Settings,
  Shield,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { normalizeChannelName } from "@/lib/message-format";
import { VIBE_PRESETS } from "@/lib/sound";
import type { Channel, Profile } from "@/types/database";
import { UserAvatar } from "./UserAvatar";

interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  currentUser: Profile;
  currentVibe: string | null;
  onChangeVibe: (vibe: string | null) => void;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (name: string, description: string) => Promise<string | null>;
  onUpdateChannel: (
    channelId: string,
    name: string,
    description: string,
  ) => Promise<string | null>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onOpenProfile: () => void;
  onCloseMobile?: () => void;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  unreadCounts,
  currentUser,
  currentVibe,
  onChangeVibe,
  onSelectChannel,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onOpenProfile,
  onCloseMobile,
}: ChannelSidebarProps) {
  const isAdmin = currentUser.role === "ADMIN";
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [showVibePicker, setShowVibePicker] = useState(false);
  const [customVibe, setCustomVibe] = useState(currentVibe ?? "");

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingChannelId || isUpdating) {
      return;
    }

    const cleaned = normalizeChannelName(editName);
    if (cleaned.length < 2) {
      setEditError("Nama channel minimal 2 karakter (huruf/angka).");
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

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    const cleaned = normalizeChannelName(name);
    if (cleaned.length < 2) {
      setFormError("Nama channel minimal 2 karakter (huruf/angka).");
      return;
    }

    setFormError("");
    setIsCreating(true);
    const error = await onCreateChannel(cleaned, description.trim());
    setIsCreating(false);

    if (error) {
      setFormError(error);
      return;
    }

    setName("");
    setDescription("");
    setShowCreateForm(false);
  }

  function handleCustomVibeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = customVibe.trim().slice(0, 36);
    onChangeVibe(cleaned || null);
    setShowVibePicker(false);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-[#2b2d31]">
      {/* Header Server / Brand */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5865f2] text-white shadow-sm">
            <MessageSquareCode className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-[#f2f3f5]">
              BertemanYuk
            </p>
            <p className="text-[10px] font-medium text-[#949ba4]">
              Komunitas Chat
            </p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup daftar channel"
            className="rounded-lg p-1 text-[#949ba4] hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Daftar Channel */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Text Channels
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowCreateForm((prev) => !prev);
                setFormError("");
              }}
              title="Buat channel baru (Admin)"
              className="rounded p-1 text-[#949ba4] transition hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isAdmin && showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            className="mb-3 space-y-2 rounded-xl border border-white/10 bg-[#1e1f22] p-2.5"
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="nama-channel"
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

        <nav className="space-y-0.5" aria-label="Daftar channel">
          {channels.map((channel) => {
            const isActive = channel.id === activeChannelId;
            const unread = unreadCounts[channel.id] ?? 0;

            if (isAdmin && editingChannelId === channel.id) {
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
                    placeholder="nama-channel"
                    className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Deskripsi channel (opsional)"
                    className="w-full rounded-md border border-white/10 bg-[#2b2d31] px-2.5 py-1.5 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                  />
                  {editError && (
                    <p className="text-[11px] text-rose-300">{editError}</p>
                  )}
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
                      {isUpdating && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
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
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm font-medium"
                >
                  <Hash
                    className={`h-4 w-4 shrink-0 ${
                      isActive || unread > 0
                        ? "text-[#f2f3f5]"
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
                  {unread > 0 && !isActive && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChannelId(channel.id);
                        setEditName(channel.name);
                        setEditDescription(channel.description ?? "");
                        setEditError("");
                      }}
                      title={`Edit #${channel.name}`}
                      className="hidden rounded p-1 text-[#949ba4] hover:bg-white/10 hover:text-white group-hover:inline-flex"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {isAdmin && channels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Hapus channel #${channel.name} beserta seluruh pesannya?`,
                          )
                        ) {
                          void onDeleteChannel(channel.id);
                        }
                      }}
                      title={`Hapus #${channel.name}`}
                      className="hidden rounded p-1 text-[#949ba4] hover:bg-rose-500/20 hover:text-rose-300 group-hover:inline-flex"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
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
                {isAdmin && (
                  <Shield className="h-3 w-3 shrink-0 text-amber-300" />
                )}
              </div>
              <p className="truncate text-[10px] text-emerald-300/90">
                Online • {currentUser.role}
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

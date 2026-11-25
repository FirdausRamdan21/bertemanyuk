"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Loader2,
  Lock,
  Plus,
  Save,
  Settings2,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { normalizeChannelName } from "@/lib/message-format";
import { createClient } from "@/lib/supabase/client";
import type { MemberWithCommunityRole } from "@/types/chat";
import type {
  Channel,
  CommunityRole,
  Database,
  RoomPermission,
  RoomTabSettings,
} from "@/types/database";

interface RoomSettingsModalProps {
  isOpen: boolean;
  channel: Channel;
  roles: CommunityRole[];
  members: MemberWithCommunityRole[];
  v2Ready: boolean;
  onClose: () => void;
  onSaved: (updated: Channel) => void;
}

type SettingsTab = "general" | "access" | "members";

const TAB_LABELS: Array<{ key: keyof RoomTabSettings; label: string }> = [
  { key: "links", label: "Tab Tautan (Link)" },
  { key: "code", label: "Tab Kode" },
  { key: "bookmarks", label: "Tab Saku Pesan" },
  { key: "solutions", label: "Tab Solusi" },
  { key: "media", label: "Tab Media (Galeri)" },
];

export function RoomSettingsModal({
  isOpen,
  channel,
  roles,
  members,
  v2Ready,
  onClose,
  onSaved,
}: RoomSettingsModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const isChatRoom = (channel.room_type ?? "chat") === "chat";

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [isPrivate, setIsPrivate] = useState(Boolean(channel.is_private));
  const [allowMemberMessages, setAllowMemberMessages] = useState(
    channel.allow_member_messages ?? true,
  );
  const [tabs, setTabs] = useState<RoomTabSettings>({
    links: channel.settings?.tabs?.links ?? true,
    code: channel.settings?.tabs?.code ?? true,
    bookmarks: channel.settings?.tabs?.bookmarks ?? true,
    solutions: channel.settings?.tabs?.solutions ?? true,
    media: channel.settings?.tabs?.media ?? true,
  });

  const [permissions, setPermissions] = useState<RoomPermission[]>([]);
  const [permTargetType, setPermTargetType] = useState<"role" | "user">("role");
  const [permTargetId, setPermTargetId] = useState("");
  const [permCanSend, setPermCanSend] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !v2Ready) {
      return;
    }

    let cancelled = false;

    async function loadPermissions() {
      const { data } = await supabase
        .from("room_permissions")
        .select("*")
        .eq("room_id", channel.id)
        .order("created_at", { ascending: true });

      if (!cancelled && data) {
        setPermissions(data);
      }
    }

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [isOpen, v2Ready, channel.id, supabase]);

  if (!isOpen) {
    return null;
  }

  async function handleSaveGeneralOrAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    const cleanedName = normalizeChannelName(name);
    if (cleanedName.length < 2) {
      setErrorMsg("Nama ruang minimal 2 karakter (huruf/angka).");
      return;
    }

    setErrorMsg("");
    setIsSaving(true);

    const patch: Database["public"]["Tables"]["channels"]["Update"] = v2Ready
      ? {
          name: cleanedName,
          description: description.trim() || null,
          is_private: isPrivate,
          allow_member_messages: allowMemberMessages,
          settings: { tabs },
        }
      : {
          name: cleanedName,
          description: description.trim() || null,
        };

    const { data, error } = await supabase
      .from("channels")
      .update(patch)
      .eq("id", channel.id)
      .select("*")
      .single();

    setIsSaving(false);

    if (error || !data) {
      setErrorMsg(
        error?.code === "23505"
          ? "Nama ruang sudah digunakan di komunitas ini."
          : (error?.message ?? "Gagal menyimpan pengaturan ruang."),
      );
      return;
    }

    onSaved(data);
    onClose();
  }

  async function handleAddPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permTargetId || isSaving) {
      return;
    }

    setErrorMsg("");
    setIsSaving(true);

    const payload: Database["public"]["Tables"]["room_permissions"]["Insert"] =
      permTargetType === "role"
        ? {
            room_id: channel.id,
            role_id: permTargetId,
            can_view: true,
            can_send: permCanSend,
          }
        : {
            room_id: channel.id,
            user_id: permTargetId,
            can_view: true,
            can_send: permCanSend,
          };

    const { data, error } = await supabase
      .from("room_permissions")
      .insert(payload)
      .select("*")
      .single();

    setIsSaving(false);

    if (error || !data) {
      setErrorMsg(error?.message ?? "Gagal menambah izin anggota.");
      return;
    }

    setPermissions((prev) => [...prev, data]);
    setPermTargetId("");
  }

  async function handleDeletePermission(permId: string) {
    const { error } = await supabase
      .from("room_permissions")
      .delete()
      .eq("id", permId);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setPermissions((prev) => prev.filter((p) => p.id !== permId));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#313338] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-5 w-5 text-[#8ea1e1]" />
            <div>
              <h2 className="text-base font-bold text-[#f2f3f5]">
                Pengaturan Ruang — {channel.name}
              </h2>
              <p className="text-xs text-[#949ba4]">
                Atur informasi umum, tab arsip, privasi, dan anggota ruang.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex gap-1.5 border-b border-white/10 bg-[#2b2d31] px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "general"
                ? "bg-[#5865f2] text-white"
                : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Umum</span>
          </button>

          {v2Ready && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("access")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "access"
                    ? "bg-[#5865f2] text-white"
                    : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Akses</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("members")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "members"
                    ? "bg-[#5865f2] text-white"
                    : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Anggota ({permissions.length})</span>
              </button>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "members" ? (
            <div className="space-y-4">
              <form
                onSubmit={handleAddPermission}
                className="space-y-3 rounded-xl border border-white/10 bg-[#2b2d31] p-4"
              >
                <p className="text-xs font-semibold text-[#f2f3f5]">
                  Tambah Izin Peran / Anggota Spesifik
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={permTargetType}
                    onChange={(e) => {
                      setPermTargetType(e.target.value as "role" | "user");
                      setPermTargetId("");
                    }}
                    className="rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="role">Peran Komunitas</option>
                    <option value="user">Pengguna Spesifik</option>
                  </select>

                  <select
                    required
                    value={permTargetId}
                    onChange={(e) => setPermTargetId(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none sm:col-span-2"
                  >
                    <option value="">
                      {permTargetType === "role"
                        ? "-- Pilih Peran --"
                        : "-- Pilih Anggota --"}
                    </option>
                    {permTargetType === "role"
                      ? roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))
                      : members.map((m) => (
                          <option key={m.id} value={m.id}>
                            @{m.username}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-[#dbdee1]">
                    <input
                      type="checkbox"
                      checked={permCanSend}
                      onChange={(e) => setPermCanSend(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#5865f2]"
                    />
                    <span>Izinkan mengirim pesan di ruang ini</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving || !permTargetId}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </form>

              {permissions.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#949ba4]">
                  Belum ada aturan khusus anggota/peran. Semua anggota komunitas
                  mengikuti pengaturan umum ruang.
                </p>
              ) : (
                <ul className="space-y-2">
                  {permissions.map((perm) => {
                    const roleObj = perm.role_id
                      ? roles.find((r) => r.id === perm.role_id)
                      : null;
                    const memberObj = perm.user_id
                      ? members.find((m) => m.id === perm.user_id)
                      : null;

                    return (
                      <li
                        key={perm.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-[#8ea1e1]" />
                          <div>
                            <p className="font-semibold text-[#f2f3f5]">
                              {roleObj
                                ? `Peran: ${roleObj.name}`
                                : memberObj
                                  ? `@${memberObj.username}`
                                  : "Target tidak ditemukan"}
                            </p>
                            <p className="text-[11px] text-[#949ba4]">
                              {perm.can_send
                                ? "Boleh melihat & mengirim pesan"
                                : "Hanya boleh melihat (read-only)"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDeletePermission(perm.id)}
                          className="rounded-lg p-1.5 text-[#949ba4] hover:bg-rose-500/20 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveGeneralOrAccess} className="space-y-5">
              {activeTab === "general" ? (
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="room-name"
                      className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                    >
                      Nama Ruang
                    </label>
                    <input
                      id="room-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2 text-sm text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="room-desc"
                      className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                    >
                      Deskripsi Ruang
                    </label>
                    <textarea
                      id="room-desc"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Jelaskan topik atau aturan ruang ini..."
                      className="w-full resize-none rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>

                  {v2Ready && isChatRoom && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
                        Tab Panel Informasi Ruang
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TAB_LABELS.map((item) => (
                          <label
                            key={item.key}
                            className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-[#2b2d31] px-3.5 py-2.5 text-xs text-[#dbdee1] hover:border-white/20"
                          >
                            <span>{item.label}</span>
                            <input
                              type="checkbox"
                              checked={tabs[item.key]}
                              onChange={(e) =>
                                setTabs((prev) => ({
                                  ...prev,
                                  [item.key]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#5865f2]"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2d31] p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#f2f3f5]">
                        Mode Ruang Privat
                      </p>
                      <p className="mt-0.5 text-xs text-[#949ba4]">
                        Tandai ruang ini sebagai ruang privat untuk peran atau
                        anggota terpilih.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#5865f2]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2d31] p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#f2f3f5]">
                        Izinkan Anggota Mengetik
                      </p>
                      <p className="mt-0.5 text-xs text-[#949ba4]">
                        Jika dimatikan, hanya Pemilik &amp; Pengurus yang dapat
                        mengirim pesan (cocok untuk ruang pengumuman).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowMemberMessages}
                      onChange={(e) => setAllowMemberMessages(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#5865f2]"
                    />
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

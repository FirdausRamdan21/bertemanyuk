"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  FolderKanban,
  Loader2,
  MessageSquare,
  Plus,
  Settings2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { normalizeChannelName } from "@/lib/message-format";
import type { Channel, RoomType } from "@/types/database";

interface CollectionViewProps {
  collection: Channel;
  allRooms: Channel[];
  roomViewerCounts: Record<string, number>;
  canManageCollection: boolean;
  canCreateChildRoom: boolean;
  onSelectRoom: (roomId: string) => void;
  onOpenCollectionSettings: () => void;
  onCreateRoomInCollection: (
    name: string,
    description: string,
    roomType: Exclude<RoomType, "collection">,
    subcategory: string,
  ) => Promise<string | null>;
}

export function CollectionView({
  collection,
  allRooms,
  roomViewerCounts,
  canManageCollection,
  canCreateChildRoom,
  onSelectRoom,
  onOpenCollectionSettings,
  onCreateRoomInCollection,
}: CollectionViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roomType, setRoomType] = useState<"chat" | "voice">("chat");
  const [subcategory, setSubcategory] = useState("Umum");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const childRooms = useMemo(
    () => allRooms.filter((r) => r.parent_collection_id === collection.id),
    [allRooms, collection.id],
  );

  // Kelompokkan berdasarkan sub-kategori
  const groupedRooms = useMemo(() => {
    const groups = new Map<string, Channel[]>();

    for (const room of childRooms) {
      const cat = (room.subcategory ?? "").trim() || "Umum";
      const list = groups.get(cat) ?? [];
      list.push(room);
      groups.set(cat, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "id"),
    );
  }, [childRooms]);

  const existingSubcategories = useMemo(
    () => groupedRooms.map(([cat]) => cat),
    [groupedRooms],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    const cleanedName = normalizeChannelName(name);
    if (cleanedName.length < 2) {
      setFormError("Nama ruang minimal 2 karakter (huruf/angka).");
      return;
    }

    setFormError("");
    setIsCreating(true);
    const err = await onCreateRoomInCollection(
      cleanedName,
      description.trim(),
      roomType,
      subcategory.trim() || "Umum",
    );
    setIsCreating(false);

    if (err) {
      setFormError(err);
      return;
    }

    setName("");
    setDescription("");
    setShowAddForm(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-7">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Ruang Koleksi */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                Ruang Koleksi
              </p>
              <h2 className="text-xl font-bold text-[#f2f3f5]">
                {collection.name}
              </h2>
              <p className="mt-1 text-sm text-[#b5bac1]">
                {collection.description ||
                  "Wadah pengelompokan ruang diskusi berdasarkan topik dan sub-kategori."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateChildRoom && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((prev) => !prev);
                  setFormError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4752c4]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Ruang</span>
              </button>
            )}

            {canManageCollection && (
              <button
                type="button"
                onClick={onOpenCollectionSettings}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2 text-xs font-semibold text-[#dbdee1] transition hover:bg-white/10 hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
                <span>Pengaturan Koleksi</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Tambah Ruang di Dalam Koleksi */}
        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-[#5865f2]/40 bg-[#2b2d31] p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f2f3f5]">
                Tambah Ruang ke Koleksi {collection.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded p-1 text-[#949ba4] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#b5bac1]">
                  Jenis Ruang
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomType("chat")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      roomType === "chat"
                        ? "border-[#5865f2] bg-[#5865f2] text-white"
                        : "border-white/10 bg-[#1e1f22] text-[#b5bac1]"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ruang Obrolan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomType("voice")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      roomType === "voice"
                        ? "border-[#5865f2] bg-[#5865f2] text-white"
                        : "border-white/10 bg-[#1e1f22] text-[#b5bac1]"
                    }`}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Ruang Suara</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="col-subcat"
                  className="block text-xs font-semibold text-[#b5bac1]"
                >
                  Sub-Kategori
                </label>
                <input
                  id="col-subcat"
                  list="existing-subcategories"
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="misal: Frontend, Desain, Proyek"
                  className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-xs text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                />
                <datalist id="existing-subcategories">
                  {existingSubcategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="col-room-name"
                  className="block text-xs font-semibold text-[#b5bac1]"
                >
                  Nama Ruang
                </label>
                <input
                  id="col-room-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="misal: diskusi-react"
                  className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-sm text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="col-room-desc"
                  className="block text-xs font-semibold text-[#b5bac1]"
                >
                  Deskripsi (Opsional)
                </label>
                <input
                  id="col-room-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topik singkat ruang ini..."
                  className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-sm text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
              >
                {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Simpan Ruang</span>
              </button>
            </div>
          </form>
        )}

        {/* Daftar Ruang Anak Dikelompokkan per Sub-Kategori */}
        {groupedRooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#2b2d31]/50 p-10 text-center">
            <FolderKanban className="mx-auto mb-2.5 h-8 w-8 text-[#949ba4]" />
            <p className="text-sm font-semibold text-[#f2f3f5]">
              Koleksi ini belum memiliki ruang
            </p>
            <p className="mt-1 text-xs text-[#949ba4]">
              Klik tombol <strong>Tambah Ruang</strong> di atas untuk
              mengelompokkan Ruang Obrolan atau Ruang Suara berdasarkan
              sub-kategori.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRooms.map(([subcat, rooms]) => (
              <section key={subcat} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
                    {subcat}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#949ba4]">
                    {rooms.length} ruang
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {rooms.map((room) => {
                    const isVoice = room.room_type === "voice";
                    const viewers = roomViewerCounts[room.id] ?? 0;

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onSelectRoom(room.id)}
                        className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#2b2d31] p-4 text-left transition hover:border-[#5865f2]/60 hover:bg-[#35373c]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isVoice ? (
                                <Volume2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <MessageSquare className="h-4 w-4 text-[#8ea1e1]" />
                              )}
                              <span className="text-sm font-bold text-[#f2f3f5] group-hover:text-white">
                                {room.name}
                              </span>
                            </div>

                            {viewers > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                <Users className="h-2.5 w-2.5" />
                                {viewers}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-xs text-[#949ba4]">
                            {room.description ||
                              (isVoice
                                ? "Ruang panggilan suara."
                                : "Ruang obrolan teks & media.")}
                          </p>
                        </div>

                        <p className="mt-3 text-[11px] font-semibold text-[#8ea1e1] group-hover:underline">
                          Buka {isVoice ? "Ruang Suara" : "Ruang Obrolan"} →
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

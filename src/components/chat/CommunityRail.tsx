"use client";

import { useState, type FormEvent } from "react";
import { Compass, Loader2, Plus, Sparkles, X } from "lucide-react";
import type { Community } from "@/types/database";

interface CommunityRailProps {
  communities: Community[];
  activeCommunityId: string | null;
  v2Ready: boolean;
  onSelectCommunity: (communityId: string) => void;
  onCreateCommunity: (
    name: string,
    description: string,
  ) => Promise<string | null>;
  onJoinCommunity: (inviteCode: string) => Promise<string | null>;
}

function getCommunityInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "KM";
}

export function CommunityRail({
  communities,
  activeCommunityId,
  v2Ready,
  onSelectCommunity,
  onCreateCommunity,
  onJoinCommunity,
}: CommunityRailProps) {
  const [modalMode, setModalMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const cleanedName = name.trim();
    if (cleanedName.length < 2) {
      setFormError("Nama komunitas minimal 2 karakter.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    const err = await onCreateCommunity(cleanedName, description.trim());
    setIsSubmitting(false);

    if (err) {
      setFormError(err);
      return;
    }

    setName("");
    setDescription("");
    setModalMode(null);
  }

  async function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const cleanedCode = inviteCode.trim().toUpperCase();
    if (cleanedCode.length < 4) {
      setFormError("Masukkan kode undangan yang valid.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    const err = await onJoinCommunity(cleanedCode);
    setIsSubmitting(false);

    if (err) {
      setFormError(err);
      return;
    }

    setInviteCode("");
    setModalMode(null);
  }

  return (
    <>
      <nav
        aria-label="Daftar Komunitas"
        className="flex h-full w-[68px] shrink-0 flex-col items-center gap-2.5 border-r border-white/10 bg-[#1e1f22] py-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5865f2] text-white shadow-md shadow-[#5865f2]/25">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="h-px w-8 bg-white/10" />

        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto px-1">
          {communities.map((community) => {
            const isActive = community.id === activeCommunityId;
            return (
              <div key={community.id} className="relative flex items-center">
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-2.5 h-6 w-1 rounded-r-full bg-white"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelectCommunity(community.id)}
                  title={community.name}
                  className={`flex h-11 w-11 items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? "rounded-2xl bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/30"
                      : "rounded-[22px] bg-[#313338] text-[#dbdee1] hover:rounded-2xl hover:bg-[#5865f2] hover:text-white"
                  }`}
                >
                  {getCommunityInitials(community.name)}
                </button>
              </div>
            );
          })}

          {v2Ready && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFormError("");
                  setModalMode("create");
                }}
                title="Buat Komunitas Baru"
                className="flex h-11 w-11 items-center justify-center rounded-[22px] border border-dashed border-emerald-400/35 bg-[#2b2d31] text-emerald-300 transition hover:rounded-2xl hover:border-emerald-400 hover:bg-emerald-500 hover:text-white"
              >
                <Plus className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormError("");
                  setModalMode("join");
                }}
                title="Gabung Komunitas dengan Kode Undangan"
                className="flex h-11 w-11 items-center justify-center rounded-[22px] border border-white/10 bg-[#2b2d31] text-[#b5bac1] transition hover:rounded-2xl hover:bg-[#5865f2] hover:text-white"
              >
                <Compass className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Modal Buat / Gabung Komunitas */}
      {modalMode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#313338] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#f2f3f5]">
                {modalMode === "create"
                  ? "Buat Komunitas Baru"
                  : "Gabung ke Komunitas"}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalMode === "create" ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <p className="text-xs leading-relaxed text-[#b5bac1]">
                  Sistem otomatis menyiapkan{" "}
                  <strong className="text-white">1 Ruang Obrolan</strong>,{" "}
                  <strong className="text-white">1 Ruang Suara</strong>, serta 3
                  peran bawaan (Pemilik, Pengurus, Anggota).
                </p>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comm-name"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                  >
                    Nama Komunitas
                  </label>
                  <input
                    id="comm-name"
                    type="text"
                    required
                    maxLength={48}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="misal: Ngoding Bareng ID"
                    className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comm-desc"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                  >
                    Deskripsi (Opsional)
                  </label>
                  <textarea
                    id="comm-desc"
                    rows={2}
                    maxLength={160}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ceritakan topik komunitas ini..."
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                {formError && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
                  >
                    {isSubmitting && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Buat Komunitas</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <p className="text-xs leading-relaxed text-[#b5bac1]">
                  Masukkan kode undangan 8 karakter yang dibagikan oleh Pemilik
                  atau anggota komunitas.
                </p>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comm-invite"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
                  >
                    Kode Undangan
                  </label>
                  <input
                    id="comm-invite"
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: A1B2C3D4"
                    className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 font-mono text-sm uppercase tracking-widest text-[#f2f3f5] placeholder:tracking-normal placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                {formError && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
                  >
                    {isSubmitting && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Gabung Sekarang</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

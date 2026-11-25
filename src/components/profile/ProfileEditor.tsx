"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, UserCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  isValidHttpUrl,
  isValidUsername,
  normalizeUsername,
} from "@/lib/validation";
import type { Profile } from "@/types/database";

interface ProfileEditorProps {
  initialProfile: Profile;
  email: string;
}

export function ProfileEditor({ initialProfile, email }: ProfileEditorProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialProfile.username);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? "");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const previewUrl = avatarUrl.trim();
  const initials = (username.trim() || initialProfile.username)
    .slice(0, 2)
    .toUpperCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedUsername = normalizeUsername(username);
    const trimmedAvatar = avatarUrl.trim();

    if (!isValidUsername(normalizedUsername)) {
      setErrorMessage(
        "Username harus 3–24 karakter dan hanya boleh berisi huruf kecil, angka, atau underscore (_).",
      );
      return;
    }

    if (!isValidHttpUrl(trimmedAvatar)) {
      setErrorMessage(
        "URL avatar harus diawali dengan http:// atau https://.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          username: normalizedUsername,
          avatar_url: trimmedAvatar || null,
        })
        .eq("id", initialProfile.id);

      if (error) {
        if (error.code === "23505") {
          setErrorMessage(
            "Username tersebut sudah dipakai anggota lain. Pilih username lain.",
          );
        } else {
          setErrorMessage(error.message);
        }
        setIsSaving(false);
        return;
      }

      setUsername(normalizedUsername);
      setSuccessMessage("Profil berhasil diperbarui.");
      setIsSaving(false);
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal menyimpan profil.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#2b2d31] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#5865f2]/20 text-lg font-bold text-[#c7d0ff]">
            {previewUrl && !avatarLoadError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Avatar ${username}`}
                onError={() => setAvatarLoadError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials || <UserCircle2 className="h-8 w-8" />}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-bold text-[#f2f3f5]">
                @{initialProfile.username}
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  initialProfile.role === "ADMIN"
                    ? "border border-amber-400/30 bg-amber-400/15 text-amber-300"
                    : "border border-[#5865f2]/40 bg-[#5865f2]/20 text-[#b7c0ff]"
                }`}
              >
                {initialProfile.role}
              </span>
            </div>
            <p className="truncate text-sm text-[#949ba4]">{email}</p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200"
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="profile-username"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            required
            disabled={isSaving}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username_kamu"
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:opacity-60"
          />
          <p className="text-xs text-[#949ba4]">
            3–24 karakter: huruf kecil, angka, atau underscore (_).
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-avatar"
            className="block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]"
          >
            URL Avatar (Opsional)
          </label>
          <input
            id="profile-avatar"
            type="url"
            disabled={isSaving}
            value={avatarUrl}
            onChange={(e) => {
              setAvatarUrl(e.target.value);
              setAvatarLoadError(false);
            }}
            placeholder="https://example.com/avatar.png"
            className="w-full rounded-lg border border-white/10 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan"}</span>
        </button>
      </form>
    </div>
  );
}

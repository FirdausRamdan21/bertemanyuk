"use client";

import { X } from "lucide-react";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import type { Profile } from "@/types/database";

interface ProfileModalProps {
  isOpen: boolean;
  profile: Profile;
  email: string;
  onClose: () => void;
}

export function ProfileModal({
  isOpen,
  profile,
  email,
  onClose,
}: ProfileModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#313338] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="profile-modal-title"
            className="text-lg font-bold text-[#f2f3f5]"
          >
            Pengaturan Profil
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal profil"
            className="rounded-lg p-1.5 text-[#949ba4] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ProfileEditor initialProfile={profile} email={email} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface UserAvatarProps {
  username: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

export function UserAvatar({
  username,
  avatarUrl,
  size = "md",
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = (username || "??").slice(0, 2).toUpperCase();
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#5865f2]/25 font-bold text-[#c7d0ff] ${SIZE_CLASSES[size]}`}
    >
      {showImage && avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={username}
          onError={() => setFailedUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

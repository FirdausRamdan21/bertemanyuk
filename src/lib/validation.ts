export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

/**
 * Menormalkan input username menjadi huruf kecil tanpa spasi pinggir.
 */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Memvalidasi format username (3-24 karakter: huruf kecil, angka, atau underscore).
 */
export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(normalizeUsername(value));
}

/**
 * Menghasilkan kandidat username yang aman dari metadata user/email saat fallback profil dibuat.
 */
export function buildFallbackUsername(seed: string, userId: string): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);

  const prefix = cleaned.length >= 3 ? cleaned : "member";
  const suffix = userId.replace(/-/g, "").slice(0, 6);
  return `${prefix}_${suffix}`;
}

/**
 * Memastikan path redirect internal aman dan tidak mengarah ke domain eksternal.
 */
export function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/chat";
  }

  return rawNext;
}

/**
 * Memvalidasi URL avatar opsional agar hanya menerima HTTP(S).
 */
export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

import type { PollOption } from "@/types/database";

export type BlockSegment =
  | { type: "text"; content: string }
  | { type: "codeblock"; language: string; content: string };

export type InlineSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string }
  | { type: "spoiler"; content: string }
  | { type: "link"; content: string; href: string }
  | { type: "mention"; username: string };

const URL_REGEX = /https?:\/\/[^\s<>()]+/i;
const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
const INLINE_TOKEN_REGEX =
  /(\|\|[\s\S]+?\|\||`[^`\n]+`|https?:\/\/[^\s<>()]+|@[a-z0-9_]{3,24}\b)/gi;

export function hasMessageLink(content: string): boolean {
  return URL_REGEX.test(content);
}

export function hasMessageCode(content: string): boolean {
  return /```[\s\S]*?```/.test(content) || /`[^`\n]+`/.test(content);
}

export function hasUserMention(content: string, username: string): boolean {
  if (!username) {
    return false;
  }
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-zA-Z0-9_])@${escaped}\\b`, "i").test(content);
}

/**
 * Memecah konten pesan menjadi blok teks biasa dan blok kode (```...```).
 */
export function parseMessageBlocks(content: string): BlockSegment[] {
  const segments: BlockSegment[] = [];
  let lastIndex = 0;

  CODE_BLOCK_REGEX.lastIndex = 0;
  let match = CODE_BLOCK_REGEX.exec(content);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: "codeblock",
      language: (match[1] ?? "").trim(),
      content: match[2].replace(/\n$/, ""),
    });

    lastIndex = match.index + match[0].length;
    match = CODE_BLOCK_REGEX.exec(content);
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: "text", content }];
}

/**
 * Memecah satu blok teks menjadi token teks biasa, inline `code`, ||spoiler||, dan URL.
 */
export function parseInlineTokens(text: string): InlineSegment[] {
  const tokens: InlineSegment[] = [];
  let lastIndex = 0;

  INLINE_TOKEN_REGEX.lastIndex = 0;
  let match = INLINE_TOKEN_REGEX.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const token = match[0];

    if (token.startsWith("||") && token.endsWith("||") && token.length > 4) {
      tokens.push({
        type: "spoiler",
        content: token.slice(2, -2),
      });
    } else if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      tokens.push({
        type: "code",
        content: token.slice(1, -1),
      });
    } else if (/^https?:\/\//i.test(token)) {
      // Hapus tanda baca di akhir URL agar tautan tetap valid
      const trimmedHref = token.replace(/[.,!?;:]+$/, "");
      const trailingPunctuation = token.slice(trimmedHref.length);

      tokens.push({
        type: "link",
        content: trimmedHref,
        href: trimmedHref,
      });

      if (trailingPunctuation) {
        tokens.push({
          type: "text",
          content: trailingPunctuation,
        });
      }
    } else if (token.startsWith("@") && token.length > 3) {
      tokens.push({
        type: "mention",
        username: token.slice(1).toLowerCase(),
      });
    } else {
      tokens.push({ type: "text", content: token });
    }

    lastIndex = match.index + token.length;
    match = INLINE_TOKEN_REGEX.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

export type ParsedPollCommand = {
  question: string;
  options: PollOption[];
};

/**
 * Mengurai perintah slash `/poll Pertanyaan? | Opsi A | Opsi B | Opsi C`.
 * Mengembalikan null jika pesan bukan perintah `/poll`, atau string error jika format kurang tepat.
 */
export function parsePollCommand(
  input: string,
): { ok: true; poll: ParsedPollCommand } | { ok: false; error: string } | null {
  const trimmed = input.trim();
  if (!trimmed.toLowerCase().startsWith("/poll")) {
    return null;
  }

  const rest = trimmed.slice(5).trim();
  if (!rest) {
    return {
      ok: false,
      error: 'Format poll: /poll Pertanyaan? | Opsi 1 | Opsi 2 (minimal 2 opsi).',
    };
  }

  const parts = rest
    .split("|")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  if (parts.length < 3) {
    return {
      ok: false,
      error:
        "Poll membutuhkan 1 pertanyaan dan minimal 2 opsi dipisah tanda `|`. Contoh: /poll Makan apa? | Bakso | Mie Ayam",
    };
  }

  const [question, ...rawOptions] = parts;
  const uniqueOptions = rawOptions.slice(0, 6);

  return {
    ok: true,
    poll: {
      question,
      options: uniqueOptions.map((text, index) => ({
        id: `opt_${index + 1}`,
        text,
      })),
    },
  };
}

/**
 * Memformat timestamp pesan ke format jam/tanggal lokal Indonesia yang ringkas.
 */
export function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay) {
    return `Hari ini ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return `Kemarin ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
  return `${dateStr} ${timeStr}`;
}

/**
 * Membersihkan nama channel agar hanya berisi huruf kecil, angka, dan tanda hubung.
 */
export function normalizeChannelName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

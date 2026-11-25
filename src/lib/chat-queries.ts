import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, PollWithVotes } from "@/types/chat";
import type {
  Database,
  Poll,
  PollOption,
  PollVote,
  Profile,
} from "@/types/database";

type LoadChannelMessagesResult = {
  messages: ChatMessage[];
  phase2Ready: boolean;
  error: string | null;
};

function normalizePollOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is { id: string; text: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).text === "string",
    )
    .map((item) => ({ id: item.id, text: item.text }));
}

/**
 * Mengambil riwayat pesan untuk satu channel beserta profil penulis, balasan,
 * bookmark pribadi, highlight solusi, dan data poll + vote.
 */
export async function loadChannelMessages(
  supabase: SupabaseClient<Database>,
  channelId: string,
  currentUserId: string,
  knownProfiles: Profile[],
): Promise<LoadChannelMessagesResult> {
  const { data: rawMessages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return {
      messages: [],
      phase2Ready: true,
      error: messagesError.message,
    };
  }

  const messages = rawMessages ?? [];
  const profileMap = new Map<string, Profile>();
  for (const profile of knownProfiles) {
    profileMap.set(profile.id, profile);
  }

  const messageIds = messages.map((m) => m.id);
  const bookmarkedIds = new Set<string>();
  const highlightMap = new Map<string, string | null>();
  const pollByMessageId = new Map<string, PollWithVotes>();
  let phase2Ready = true;

  if (messageIds.length > 0) {
    const [bookmarksRes, highlightsRes, pollsRes] = await Promise.all([
      supabase
        .from("message_bookmarks")
        .select("message_id")
        .eq("user_id", currentUserId)
        .in("message_id", messageIds),
      supabase
        .from("message_highlights")
        .select("message_id, highlighted_by")
        .eq("channel_id", channelId),
      supabase.from("polls").select("*").in("message_id", messageIds),
    ]);

    if (bookmarksRes.error || highlightsRes.error || pollsRes.error) {
      phase2Ready = false;
    } else {
      for (const b of bookmarksRes.data ?? []) {
        bookmarkedIds.add(b.message_id);
      }

      for (const h of highlightsRes.data ?? []) {
        highlightMap.set(h.message_id, h.highlighted_by);
      }

      const polls = (pollsRes.data ?? []) as Poll[];
      const pollIds = polls.map((p) => p.id);
      const votesByPollId = new Map<string, PollVote[]>();

      if (pollIds.length > 0) {
        const { data: votesData, error: votesError } = await supabase
          .from("poll_votes")
          .select("*")
          .in("poll_id", pollIds);

        if (votesError) {
          phase2Ready = false;
        } else {
          for (const vote of votesData ?? []) {
            const list = votesByPollId.get(vote.poll_id) ?? [];
            list.push(vote);
            votesByPollId.set(vote.poll_id, list);
          }
        }
      }

      for (const poll of polls) {
        pollByMessageId.set(poll.message_id, {
          ...poll,
          options: normalizePollOptions(poll.options),
          votes: votesByPollId.get(poll.id) ?? [],
        });
      }
    }
  } else {
    // Cek ringan apakah tabel Fase 2 sudah tersedia di Supabase
    const { error: probeError } = await supabase
      .from("message_bookmarks")
      .select("message_id")
      .eq("user_id", currentUserId)
      .limit(1);

    if (probeError) {
      phase2Ready = false;
    }
  }

  const messageById = new Map(messages.map((m) => [m.id, m]));

  const hydrated: ChatMessage[] = messages.map((msg) => {
    const replyTarget = msg.reply_to_id
      ? messageById.get(msg.reply_to_id) ?? null
      : null;
    const replyAuthor = replyTarget
      ? profileMap.get(replyTarget.user_id) ?? null
      : null;

    return {
      ...msg,
      author: profileMap.get(msg.user_id) ?? null,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            content: replyTarget.content,
            authorUsername: replyAuthor?.username ?? "anggota",
          }
        : null,
      poll: pollByMessageId.get(msg.id) ?? null,
      isBookmarked: bookmarkedIds.has(msg.id),
      isHighlighted: highlightMap.has(msg.id),
      highlightedBy: highlightMap.get(msg.id) ?? null,
    };
  });

  return {
    messages: hydrated,
    phase2Ready,
    error: null,
  };
}

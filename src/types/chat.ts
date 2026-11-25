import type { Channel, Message, Poll, PollVote, Profile } from "./database";

export type MessageFilterType = "all" | "links" | "code" | "bookmarks" | "highlights";

export type TypingMode = "text" | "code" | "poll";

export type TypingEventPayload = {
  userId: string;
  username: string;
  channelId: string;
  mode: TypingMode;
};

export type ActiveTyper = {
  userId: string;
  username: string;
  mode: TypingMode;
  expiresAt: number;
};

export type PresenceUserState = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  activeChannelId: string | null;
  vibe: string | null;
  onlineAt: string;
};

export type RealtimeConnectionStatus = "connecting" | "connected" | "error";

export type PollWithVotes = Poll & {
  votes: PollVote[];
};

export type ChatMessage = Message & {
  author: Profile | null;
  replyTo: {
    id: string;
    content: string;
    authorUsername: string;
  } | null;
  poll: PollWithVotes | null;
  isBookmarked: boolean;
  isHighlighted: boolean;
  highlightedBy: string | null;
};

export type ChatInitialData = {
  currentUser: Profile;
  userEmail: string;
  channels: Channel[];
  members: Profile[];
  initialChannelId: string | null;
  initialMessages: ChatMessage[];
  phase2Ready: boolean;
};

export type UserRole = "ADMIN" | "MEMBER";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PollOption = {
  id: string;
  text: string;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
};

export type Channel = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  reply_to_id: string | null;
  created_at: string;
};

export type MessageBookmark = {
  user_id: string;
  message_id: string;
  created_at: string;
};

export type MessageHighlight = {
  message_id: string;
  channel_id: string;
  highlighted_by: string | null;
  created_at: string;
};

export type Poll = {
  id: string;
  message_id: string;
  question: string;
  options: PollOption[];
  created_at: string;
};

export type PollVote = {
  poll_id: string;
  user_id: string;
  option_id: string;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      channels: {
        Row: Channel;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          content: string;
          channel_id: string;
          user_id: string;
          reply_to_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          channel_id?: string;
          user_id?: string;
          reply_to_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_bookmarks: {
        Row: MessageBookmark;
        Insert: {
          user_id: string;
          message_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          message_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_bookmarks_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_highlights: {
        Row: MessageHighlight;
        Insert: {
          message_id: string;
          channel_id: string;
          highlighted_by?: string | null;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          channel_id?: string;
          highlighted_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_highlights_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_highlights_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_highlights_highlighted_by_fkey";
            columns: ["highlighted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      polls: {
        Row: Poll;
        Insert: {
          id?: string;
          message_id: string;
          question: string;
          options: PollOption[];
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          question?: string;
          options?: PollOption[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polls_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_votes: {
        Row: PollVote;
        Insert: {
          poll_id: string;
          user_id: string;
          option_id: string;
          created_at?: string;
        };
        Update: {
          poll_id?: string;
          user_id?: string;
          option_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

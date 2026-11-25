export type UserRole = "ADMIN" | "MEMBER";

export type RoomType = "chat" | "voice" | "collection";

export type RoomTabSettings = {
  links: boolean;
  code: boolean;
  bookmarks: boolean;
  solutions: boolean;
  media: boolean;
};

export type RoomSettings = {
  tabs?: Partial<RoomTabSettings>;
};

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

export type Community = {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type CommunityRole = {
  id: string;
  community_id: string;
  name: string;
  slug: string;
  is_system: boolean;
  can_manage_community: boolean;
  can_manage_roles: boolean;
  can_create_room: boolean;
  can_update_room: boolean;
  can_delete_room: boolean;
  can_moderate_members: boolean;
  can_send_messages: boolean;
  created_at: string;
};

export type CommunityMember = {
  community_id: string;
  user_id: string;
  role_id: string | null;
  joined_at: string;
};

export type Channel = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  community_id?: string | null;
  room_type?: RoomType;
  parent_collection_id?: string | null;
  subcategory?: string | null;
  is_private?: boolean;
  allow_member_messages?: boolean;
  settings?: RoomSettings | null;
};

export type RoomPermission = {
  id: string;
  room_id: string;
  role_id: string | null;
  user_id: string | null;
  can_view: boolean;
  can_send: boolean;
  can_manage: boolean;
  created_at: string;
};

export type Message = {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  reply_to_id: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
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
      communities: {
        Row: Community;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon_url?: string | null;
          invite_code?: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon_url?: string | null;
          invite_code?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communities_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_roles: {
        Row: CommunityRole;
        Insert: {
          id?: string;
          community_id: string;
          name: string;
          slug: string;
          is_system?: boolean;
          can_manage_community?: boolean;
          can_manage_roles?: boolean;
          can_create_room?: boolean;
          can_update_room?: boolean;
          can_delete_room?: boolean;
          can_moderate_members?: boolean;
          can_send_messages?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          name?: string;
          slug?: string;
          is_system?: boolean;
          can_manage_community?: boolean;
          can_manage_roles?: boolean;
          can_create_room?: boolean;
          can_update_room?: boolean;
          can_delete_room?: boolean;
          can_moderate_members?: boolean;
          can_send_messages?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_roles_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
        ];
      };
      community_members: {
        Row: CommunityMember;
        Insert: {
          community_id: string;
          user_id: string;
          role_id?: string | null;
          joined_at?: string;
        };
        Update: {
          community_id?: string;
          user_id?: string;
          role_id?: string | null;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "community_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: Channel;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          community_id?: string | null;
          room_type?: RoomType;
          parent_collection_id?: string | null;
          subcategory?: string | null;
          is_private?: boolean;
          allow_member_messages?: boolean;
          settings?: RoomSettings | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          community_id?: string | null;
          room_type?: RoomType;
          parent_collection_id?: string | null;
          subcategory?: string | null;
          is_private?: boolean;
          allow_member_messages?: boolean;
          settings?: RoomSettings | null;
        };
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channels_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
        ];
      };
      room_permissions: {
        Row: RoomPermission;
        Insert: {
          id?: string;
          room_id: string;
          role_id?: string | null;
          user_id?: string | null;
          can_view?: boolean;
          can_send?: boolean;
          can_manage?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          role_id?: string | null;
          user_id?: string | null;
          can_view?: boolean;
          can_send?: boolean;
          can_manage?: boolean;
          created_at?: string;
        };
        Relationships: [];
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
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
        };
        Update: {
          id?: string;
          content?: string;
          channel_id?: string;
          user_id?: string;
          reply_to_id?: string | null;
          created_at?: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_size?: number | null;
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
      is_community_member: {
        Args: { target_community_id: string };
        Returns: boolean;
      };
      has_community_permission: {
        Args: { target_community_id: string; perm: string };
        Returns: boolean;
      };
      join_community_by_code: {
        Args: { p_invite_code: string };
        Returns: string;
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

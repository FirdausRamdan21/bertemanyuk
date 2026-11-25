import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { loadChannelMessages } from "@/lib/chat-queries";
import {
  loadCommunityWorkspaceData,
  loadUserCommunities,
} from "@/lib/community-queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildFallbackUsername } from "@/lib/validation";
import type { MemberWithCommunityRole } from "@/types/chat";
import type { Channel, CommunityRole } from "@/types/database";

async function ChatAppLoader() {
  await connection();

  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!currentProfile && !profileError) {
    const meta = user.user_metadata ?? {};
    const seed =
      (typeof meta.username === "string" && meta.username) ||
      (typeof meta.user_name === "string" && meta.user_name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      user.email?.split("@")[0] ||
      "member";

    const avatarUrl =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username: buildFallbackUsername(seed, user.id),
        avatar_url: avatarUrl,
      })
      .select("*")
      .single();

    currentProfile = insertedProfile;
    profileError = insertError;
  }

  if (!currentProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] p-6 text-[#f2f3f5]">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-[#313338] p-6 text-center">
          <h1 className="text-lg font-bold text-rose-200">
            Gagal Memuat Profil Pengguna
          </h1>
          <p className="mt-2 text-sm text-[#b5bac1]">
            {profileError?.message ??
              "Pastikan Anda sudah menjalankan supabase/schema.sql di Supabase SQL Editor."}
          </p>
        </div>
      </main>
    );
  }

  const { v2Ready, communities } = await loadUserCommunities(
    supabase,
    currentProfile.id,
  );

  let initialCommunityId: string | null = null;
  let initialCommunityRoles: CommunityRole[] = [];
  let channels: Channel[] = [];
  let members: MemberWithCommunityRole[] = [];

  if (v2Ready) {
    const firstCommunity = communities[0] ?? null;
    if (firstCommunity) {
      initialCommunityId = firstCommunity.id;
      const workspaceData = await loadCommunityWorkspaceData(
        supabase,
        firstCommunity.id,
      );
      channels = workspaceData.channels;
      initialCommunityRoles = workspaceData.roles;
      members = workspaceData.members;
    } else {
      members = [{ ...currentProfile, communityRole: null }];
    }
  } else {
    // Fallback aman jika migrasi SQL v2.0 (003_v2_communities_and_rooms.sql) belum dijalankan
    const [channelsRes, membersRes] = await Promise.all([
      supabase.from("channels").select("*").order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("*")
        .order("username", { ascending: true }),
    ]);

    channels = channelsRes.data ?? [];
    members = (membersRes.data ?? [currentProfile]).map((m) => ({
      ...m,
      communityRole: null,
    }));
  }

  const defaultChannel =
    channels.find((c) => (c.room_type ?? "chat") === "chat") ??
    channels[0] ??
    null;

  const initialChannelId = defaultChannel?.id ?? null;

  const loaded = initialChannelId
    ? await loadChannelMessages(
        supabase,
        initialChannelId,
        currentProfile.id,
        members,
      )
    : { messages: [], phase2Ready: true, error: null };

  return (
    <ChatWorkspace
      currentUser={currentProfile}
      userEmail={user.email ?? ""}
      v2Ready={v2Ready}
      communities={communities}
      initialCommunityId={initialCommunityId}
      initialCommunityRoles={initialCommunityRoles}
      channels={channels}
      members={members}
      initialChannelId={initialChannelId}
      initialMessages={loaded.messages}
      phase2Ready={loaded.phase2Ready}
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-[#1e1f22] text-sm text-[#949ba4]">
          Memuat ruang diskusi BertemanYuk...
        </main>
      }
    >
      <ChatAppLoader />
    </Suspense>
  );
}

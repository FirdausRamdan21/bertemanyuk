import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { loadChannelMessages } from "@/lib/chat-queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildFallbackUsername } from "@/lib/validation";

async function ChatAppLoader() {
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

  // Fallback jika akun mendaftar sebelum trigger handle_new_user dipasang
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

  const [channelsRes, membersRes] = await Promise.all([
    supabase.from("channels").select("*").order("name", { ascending: true }),
    supabase.from("profiles").select("*").order("username", { ascending: true }),
  ]);

  const channels = channelsRes.data ?? [];
  const members = membersRes.data ?? [currentProfile];

  const defaultChannel =
    channels.find((c) => c.name === "general") ?? channels[0] ?? null;

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

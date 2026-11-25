import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberWithCommunityRole } from "@/types/chat";
import type {
  Channel,
  Community,
  CommunityRole,
  Database,
  Profile,
} from "@/types/database";

export type LoadCommunitiesResult = {
  v2Ready: boolean;
  communities: Community[];
};

export type LoadCommunityWorkspaceResult = {
  channels: Channel[];
  roles: CommunityRole[];
  members: MemberWithCommunityRole[];
};

/**
 * Mengambil seluruh Komunitas yang diikuti oleh pengguna.
 * Mengembalikan v2Ready = false secara aman jika migrasi 003 belum dijalankan.
 */
export async function loadUserCommunities(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<LoadCommunitiesResult> {
  const { data: memberships, error: memberError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);

  if (memberError) {
    return { v2Ready: false, communities: [] };
  }

  const communityIds = (memberships ?? []).map((m) => m.community_id);
  if (communityIds.length === 0) {
    // Tetap cek tabel communities untuk memastikan tidak ada komunitas tanpa membership row
    const { data: ownedCommunities, error: ownedError } = await supabase
      .from("communities")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });

    if (ownedError) {
      return { v2Ready: false, communities: [] };
    }

    return {
      v2Ready: true,
      communities: ownedCommunities ?? [],
    };
  }

  const { data: communities, error: commError } = await supabase
    .from("communities")
    .select("*")
    .in("id", communityIds)
    .order("created_at", { ascending: true });

  if (commError) {
    return { v2Ready: false, communities: [] };
  }

  return {
    v2Ready: true,
    communities: communities ?? [],
  };
}

/**
 * Mengambil daftar Ruang, Peran, dan Anggota untuk satu Komunitas aktif.
 */
export async function loadCommunityWorkspaceData(
  supabase: SupabaseClient<Database>,
  communityId: string,
): Promise<LoadCommunityWorkspaceResult> {
  const [channelsRes, rolesRes, membersRes] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("community_id", communityId)
      .order("name", { ascending: true }),
    supabase
      .from("community_roles")
      .select("*")
      .eq("community_id", communityId)
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("community_members")
      .select("user_id, role_id")
      .eq("community_id", communityId),
  ]);

  const channels = channelsRes.data ?? [];
  const roles = rolesRes.data ?? [];
  const memberRows = membersRes.data ?? [];

  const userIds = memberRows.map((m) => m.user_id);
  let profiles: Profile[] = [];

  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds)
      .order("username", { ascending: true });
    profiles = profilesData ?? [];
  }

  const roleById = new Map<string, CommunityRole>(roles.map((r) => [r.id, r]));
  const roleIdByUserId = new Map<string, string | null>(
    memberRows.map((m) => [m.user_id, m.role_id]),
  );

  const members: MemberWithCommunityRole[] = profiles.map((profile) => {
    const roleId = roleIdByUserId.get(profile.id) ?? null;
    return {
      ...profile,
      communityRole: roleId ? (roleById.get(roleId) ?? null) : null,
    };
  });

  return {
    channels,
    roles,
    members,
  };
}

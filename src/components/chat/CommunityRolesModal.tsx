"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import type { MemberWithCommunityRole } from "@/types/chat";
import type { CommunityRole } from "@/types/database";
import { UserAvatar } from "./UserAvatar";

interface CommunityRolesModalProps {
  isOpen: boolean;
  communityName: string;
  roles: CommunityRole[];
  members: MemberWithCommunityRole[];
  currentUserId: string;
  onClose: () => void;
  onCreateRole: (name: string) => Promise<string | null>;
  onUpdateRolePermission: (
    roleId: string,
    field: keyof Pick<
      CommunityRole,
      | "can_create_room"
      | "can_update_room"
      | "can_delete_room"
      | "can_moderate_members"
      | "can_send_messages"
    >,
    value: boolean,
  ) => Promise<string | null>;
  onDeleteRole: (roleId: string) => Promise<string | null>;
  onAssignMemberRole: (userId: string, roleId: string) => Promise<string | null>;
}

const PERMISSION_LABELS: Array<{
  key: keyof Pick<
    CommunityRole,
    | "can_create_room"
    | "can_update_room"
    | "can_delete_room"
    | "can_moderate_members"
    | "can_send_messages"
  >;
  label: string;
}> = [
  { key: "can_create_room", label: "Buat Ruang" },
  { key: "can_update_room", label: "Ubah Ruang" },
  { key: "can_delete_room", label: "Hapus Ruang" },
  { key: "can_moderate_members", label: "Moderasi Pesan" },
  { key: "can_send_messages", label: "Kirim Pesan" },
];

export function CommunityRolesModal({
  isOpen,
  communityName,
  roles,
  members,
  currentUserId,
  onClose,
  onCreateRole,
  onUpdateRolePermission,
  onDeleteRole,
  onAssignMemberRole,
}: CommunityRolesModalProps) {
  const [activeTab, setActiveTab] = useState<"roles" | "members">("roles");
  const [newRoleName, setNewRoleName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleAddRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newRoleName.trim();
    if (trimmed.length < 2 || busyKey) {
      setErrorMsg("Nama peran minimal 2 karakter.");
      return;
    }

    setErrorMsg("");
    setBusyKey("create-role");
    const err = await onCreateRole(trimmed);
    setBusyKey(null);

    if (err) {
      setErrorMsg(err);
      return;
    }
    setNewRoleName("");
  }

  async function handleToggle(
    roleId: string,
    field: (typeof PERMISSION_LABELS)[number]["key"],
    value: boolean,
  ) {
    setErrorMsg("");
    setBusyKey(`${roleId}:${field}`);
    const err = await onUpdateRolePermission(roleId, field, value);
    setBusyKey(null);
    if (err) {
      setErrorMsg(err);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#313338] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#f2f3f5]">
              Kelola Peran — {communityName}
            </h2>
            <p className="text-xs text-[#949ba4]">
              Atur hak akses peran bawaan (Pemilik, Pengurus, Anggota) atau
              buat peran baru.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex gap-2 border-b border-white/10 bg-[#2b2d31] px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "roles"
                ? "bg-[#5865f2] text-white"
                : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Hak Akses Peran ({roles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "members"
                ? "bg-[#5865f2] text-white"
                : "text-[#b5bac1] hover:bg-white/10 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Peran Anggota ({members.length})</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "roles" ? (
            <div className="space-y-4">
              <form onSubmit={handleAddRole} className="flex gap-2">
                <input
                  type="text"
                  maxLength={32}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Nama peran baru (misal: Mentor, Kontributor)"
                  className="flex-1 rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-2 text-sm text-[#f2f3f5] placeholder:text-[#6d737d] focus:border-[#5865f2] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busyKey === "create-role"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:opacity-50"
                >
                  {busyKey === "create-role" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Tambah Peran</span>
                </button>
              </form>

              <div className="space-y-3">
                {roles.map((role) => {
                  const isOwnerRole = role.slug === "owner";
                  return (
                    <div
                      key={role.id}
                      className="rounded-xl border border-white/10 bg-[#2b2d31] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#f2f3f5]">
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#b5bac1]">
                              Bawaan
                            </span>
                          )}
                        </div>

                        {!role.is_system && (
                          <button
                            type="button"
                            disabled={busyKey === `del:${role.id}`}
                            onClick={async () => {
                              setBusyKey(`del:${role.id}`);
                              const err = await onDeleteRole(role.id);
                              setBusyKey(null);
                              if (err) setErrorMsg(err);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {PERMISSION_LABELS.map((perm) => {
                          const checked = role[perm.key];
                          const isBusy = busyKey === `${role.id}:${perm.key}`;
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                                isOwnerRole
                                  ? "cursor-not-allowed border-white/5 bg-[#1e1f22]/50 text-[#949ba4]"
                                  : "cursor-pointer border-white/10 bg-[#1e1f22] text-[#dbdee1] hover:border-white/20"
                              }`}
                            >
                              <span>{perm.label}</span>
                              <input
                                type="checkbox"
                                disabled={isOwnerRole || isBusy}
                                checked={checked}
                                onChange={(e) =>
                                  void handleToggle(
                                    role.id,
                                    perm.key,
                                    e.target.checked,
                                  )
                                }
                                className="h-3.5 w-3.5 accent-[#5865f2]"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        username={member.username}
                        avatarUrl={member.avatar_url}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#f2f3f5]">
                          @{member.username}{" "}
                          {isSelf && (
                            <span className="text-xs text-[#8ea1e1]">
                              (Kamu)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#949ba4]">
                          {member.role === "ADMIN"
                            ? "Admin Sistem"
                            : "Pengguna"}
                        </p>
                      </div>
                    </div>

                    <select
                      aria-label={`Peran untuk ${member.username}`}
                      disabled={isSelf || busyKey === `assign:${member.id}`}
                      value={member.communityRole?.id ?? ""}
                      onChange={async (e) => {
                        setErrorMsg("");
                        setBusyKey(`assign:${member.id}`);
                        const err = await onAssignMemberRole(
                          member.id,
                          e.target.value,
                        );
                        setBusyKey(null);
                        if (err) setErrorMsg(err);
                      }}
                      className="rounded-lg border border-white/10 bg-[#1e1f22] px-3 py-1.5 text-xs font-medium text-[#f2f3f5] focus:border-[#5865f2] focus:outline-none disabled:opacity-60"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

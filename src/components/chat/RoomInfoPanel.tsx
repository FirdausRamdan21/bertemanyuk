"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Bookmark,
  Check,
  Code2,
  ExternalLink,
  FileDown,
  Image as ImageIcon,
  Info,
  Link2,
  Lock,
  X,
} from "lucide-react";
import {
  formatMessageTime,
  hasMessageCode,
  hasMessageLink,
} from "@/lib/message-format";
import type { ChatMessage } from "@/types/chat";
import type { Channel, RoomTabSettings } from "@/types/database";

type InfoTabKey = keyof RoomTabSettings;

interface RoomInfoPanelProps {
  channel: Channel;
  messages: ChatMessage[];
  phase2Ready: boolean;
  onJumpToMessage: (messageId: string) => void;
  onExportSolutionsMarkdown: () => Promise<void>;
  copiedSolutions: boolean;
  onClose: () => void;
}

const DEFAULT_TABS: RoomTabSettings = {
  links: true,
  code: true,
  bookmarks: true,
  solutions: true,
  media: true,
};

const URL_EXTRACT_REGEX = /https?:\/\/[^\s<>()]+/gi;

export function RoomInfoPanel({
  channel,
  messages,
  phase2Ready,
  onJumpToMessage,
  onExportSolutionsMarkdown,
  copiedSolutions,
  onClose,
}: RoomInfoPanelProps) {
  const enabledTabs: RoomTabSettings = useMemo(
    () => ({
      links: channel.settings?.tabs?.links ?? DEFAULT_TABS.links,
      code: channel.settings?.tabs?.code ?? DEFAULT_TABS.code,
      bookmarks: channel.settings?.tabs?.bookmarks ?? DEFAULT_TABS.bookmarks,
      solutions: channel.settings?.tabs?.solutions ?? DEFAULT_TABS.solutions,
      media: channel.settings?.tabs?.media ?? DEFAULT_TABS.media,
    }),
    [channel.settings],
  );

  const availableTabs = useMemo(() => {
    const list: Array<{
      key: InfoTabKey;
      label: string;
      icon: typeof Link2;
    }> = [];

    if (enabledTabs.links) {
      list.push({ key: "links", label: "Tautan", icon: Link2 });
    }
    if (enabledTabs.code) {
      list.push({ key: "code", label: "Kode", icon: Code2 });
    }
    if (enabledTabs.bookmarks && phase2Ready) {
      list.push({ key: "bookmarks", label: "Saku", icon: Bookmark });
    }
    if (enabledTabs.solutions && phase2Ready) {
      list.push({ key: "solutions", label: "Solusi", icon: Award });
    }
    if (enabledTabs.media) {
      list.push({ key: "media", label: "Media", icon: ImageIcon });
    }
    return list;
  }, [enabledTabs, phase2Ready]);

  const [selectedTab, setSelectedTab] = useState<InfoTabKey>("links");

  const activeTab: InfoTabKey | null = useMemo(() => {
    if (availableTabs.length === 0) {
      return null;
    }
    if (availableTabs.some((t) => t.key === selectedTab)) {
      return selectedTab;
    }
    return availableTabs[0].key;
  }, [availableTabs, selectedTab]);

  const linkMessages = useMemo(
    () =>
      messages
        .filter((m) => hasMessageLink(m.content))
        .slice()
        .reverse(),
    [messages],
  );

  const codeMessages = useMemo(
    () =>
      messages
        .filter((m) => hasMessageCode(m.content))
        .slice()
        .reverse(),
    [messages],
  );

  const bookmarkMessages = useMemo(
    () =>
      messages
        .filter((m) => m.isBookmarked)
        .slice()
        .reverse(),
    [messages],
  );

  const solutionMessages = useMemo(
    () =>
      messages
        .filter((m) => m.isHighlighted)
        .slice()
        .reverse(),
    [messages],
  );

  const mediaMessages = useMemo(
    () =>
      messages
        .filter((m) => Boolean(m.attachment_url))
        .slice()
        .reverse(),
    [messages],
  );

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-[#2b2d31]">
      {/* Header Panel Info Ruang */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
          <Info className="h-4 w-4 text-[#8ea1e1]" />
          <span>Informasi Ruang</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel informasi ruang"
          className="rounded-lg p-1 text-[#949ba4] hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Deskripsi Ruang */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-bold text-[#f2f3f5]">
            {channel.name}
          </h2>
          {channel.is_private && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <Lock className="h-2.5 w-2.5" />
              Privat
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#b5bac1]">
          {channel.description || "Belum ada deskripsi untuk ruang ini."}
        </p>
      </div>

      {/* Tab Arsip */}
      {availableTabs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[#949ba4]">
          Seluruh tab arsip dinonaktifkan oleh Pemilik atau Pengurus di
          Pengaturan Ruang.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-white/10 bg-[#232428] px-3 py-2">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTab(tab.key)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    isSelected
                      ? "bg-[#5865f2] text-white"
                      : "text-[#949ba4] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === "links" && (
              <ArchiveList
                emptyText="Belum ada tautan yang dibagikan di ruang ini."
                items={linkMessages}
                onJump={onJumpToMessage}
                renderBody={(msg) => {
                  const urls = msg.content.match(URL_EXTRACT_REGEX) ?? [];
                  return (
                    <div className="space-y-1.5">
                      {urls.slice(0, 2).map((u, idx) => {
                        const cleanHref = u.replace(/[.,!?;:]+$/, "");
                        return (
                          <a
                            key={`${msg.id}-url-${idx}`}
                            href={cleanHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 truncate text-xs font-medium text-[#00a8fc] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cleanHref}</span>
                          </a>
                        );
                      })}
                      <p className="line-clamp-2 text-[11px] text-[#949ba4]">
                        {msg.content}
                      </p>
                    </div>
                  );
                }}
              />
            )}

            {activeTab === "code" && (
              <ArchiveList
                emptyText="Belum ada potongan kode di ruang ini."
                items={codeMessages}
                onJump={onJumpToMessage}
                renderBody={(msg) => (
                  <pre className="line-clamp-4 overflow-hidden rounded-lg bg-[#1e1f22] p-2 font-mono text-[11px] text-[#dbdee1]">
                    {msg.content}
                  </pre>
                )}
              />
            )}

            {activeTab === "bookmarks" && (
              <ArchiveList
                emptyText="Saku Pesan kamu masih kosong. Klik ikon bookmark di pesan untuk menyimpannya."
                items={bookmarkMessages}
                onJump={onJumpToMessage}
                renderBody={(msg) => (
                  <p className="line-clamp-3 text-xs text-[#dbdee1]">
                    {msg.content || "[Lampiran gambar]"}
                  </p>
                )}
              />
            )}

            {activeTab === "solutions" && (
              <div className="space-y-3">
                {solutionMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void onExportSolutionsMarkdown()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {copiedSolutions ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Ringkasan Solusi Tersalin (.md)</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Salin Semua Solusi (.md)</span>
                      </>
                    )}
                  </button>
                )}

                <ArchiveList
                  emptyText="Belum ada pesan yang ditandai sebagai Solusi."
                  items={solutionMessages}
                  onJump={onJumpToMessage}
                  renderBody={(msg) => (
                    <p className="line-clamp-3 text-xs text-[#dbdee1]">
                      {msg.content || "[Lampiran gambar]"}
                    </p>
                  )}
                />
              </div>
            )}

            {activeTab === "media" && (
              <>
                {mediaMessages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#949ba4]">
                    Belum ada gambar yang dikirim di ruang ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediaMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22]"
                      >
                        <a
                          href={msg.attachment_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square overflow-hidden"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.attachment_url ?? ""}
                            alt={msg.attachment_name ?? "Lampiran gambar"}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={() => onJumpToMessage(msg.id)}
                          className="w-full truncate border-t border-white/10 bg-[#232428] px-2 py-1 text-left text-[10px] text-[#b5bac1] hover:text-white"
                        >
                          @{msg.author?.username ?? "anggota"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function ArchiveList({
  items,
  emptyText,
  onJump,
  renderBody,
}: {
  items: ChatMessage[];
  emptyText: string;
  onJump: (messageId: string) => void;
  renderBody: (msg: ChatMessage) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-xs leading-relaxed text-[#949ba4]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((msg) => (
        <div
          key={msg.id}
          className="rounded-xl border border-white/10 bg-[#1e1f22]/80 p-2.5"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-[#f2f3f5]">
              @{msg.author?.username ?? "anggota"}
            </span>
            <button
              type="button"
              onClick={() => onJump(msg.id)}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[#8ea1e1] hover:bg-[#5865f2]/20"
            >
              Lompat
            </button>
          </div>
          {renderBody(msg)}
          <p className="mt-1.5 text-[10px] text-[#6d737d]">
            {formatMessageTime(msg.created_at)}
          </p>
        </div>
      ))}
    </div>
  );
}

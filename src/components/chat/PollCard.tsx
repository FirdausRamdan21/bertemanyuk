"use client";

import { BarChart3, CheckCircle2 } from "lucide-react";
import type { PollWithVotes } from "@/types/chat";

interface PollCardProps {
  poll: PollWithVotes;
  currentUserId: string;
  onVote: (pollId: string, optionId: string) => void;
  disabled?: boolean;
}

export function PollCard({
  poll,
  currentUserId,
  onVote,
  disabled = false,
}: PollCardProps) {
  const totalVotes = poll.votes.length;
  const userVote = poll.votes.find((v) => v.user_id === currentUserId);

  return (
    <div className="mt-2 max-w-lg rounded-xl border border-[#5865f2]/30 bg-[#2b2d31] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#8ea1e1]" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8ea1e1]">
              Quick Poll
            </p>
            <h4 className="text-sm font-semibold text-[#f2f3f5]">
              {poll.question}
            </h4>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[#949ba4]">
          {totalVotes} suara
        </span>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const optionVotes = poll.votes.filter(
            (v) => v.option_id === option.id,
          ).length;
          const percentage =
            totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isSelected = userVote?.option_id === option.id;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onVote(poll.id, option.id)}
              className={`group relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                isSelected
                  ? "border-[#5865f2] bg-[#5865f2]/15 text-white"
                  : "border-white/10 bg-[#1e1f22]/70 text-[#dbdee1] hover:border-white/20 hover:bg-[#1e1f22]"
              }`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${
                  isSelected ? "bg-[#5865f2]/30" : "bg-white/5"
                }`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8ea1e1]" />
                  )}
                  <span>{option.text}</span>
                </span>

                <span className="shrink-0 text-xs font-semibold text-[#b5bac1]">
                  {percentage}% ({optionVotes})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] text-[#949ba4]">
        Klik salah satu opsi untuk memilih atau mengganti suara kamu.
      </p>
    </div>
  );
}

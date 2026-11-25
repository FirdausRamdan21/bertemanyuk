"use client";

import { useState } from "react";
import { Check, Copy, Eye } from "lucide-react";
import {
  parseInlineTokens,
  parseMessageBlocks,
} from "@/lib/message-format";

interface RichMessageContentProps {
  content: string;
  currentUsername?: string;
}

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setRevealed((prev) => !prev)}
      title={revealed ? "Klik untuk menyembunyikan spoiler" : "Klik untuk membuka spoiler"}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline text-left transition ${
        revealed
          ? "bg-white/10 text-[#f2f3f5]"
          : "bg-[#1e1f22] text-transparent hover:bg-[#232428] select-none"
      }`}
    >
      <span className={revealed ? "" : "blur-[5px] text-[#949ba4]"}>
        {text}
      </span>
      {!revealed && (
        <Eye className="inline h-3 w-3 shrink-0 text-[#949ba4]" />
      )}
    </button>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Abaikan jika izin clipboard diblokir browser
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#232428] px-3 py-1.5 text-[11px] text-[#949ba4]">
        <span className="font-mono uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-300">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[#dbdee1]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function RichMessageContent({
  content,
  currentUsername,
}: RichMessageContentProps) {
  const blocks = parseMessageBlocks(content);
  const normalizedCurrent = currentUsername?.toLowerCase() ?? "";

  return (
    <div className="space-y-1 text-sm leading-relaxed text-[#dbdee1] break-words">
      {blocks.map((block, blockIdx) => {
        if (block.type === "codeblock") {
          return (
            <CodeBlock
              key={`code-${blockIdx}`}
              language={block.language}
              code={block.content}
            />
          );
        }

        const tokens = parseInlineTokens(block.content);

        return (
          <p key={`text-${blockIdx}`} className="whitespace-pre-wrap">
            {tokens.map((token, tokenIdx) => {
              if (token.type === "code") {
                return (
                  <code
                    key={`inline-code-${tokenIdx}`}
                    className="rounded bg-[#1e1f22] px-1.5 py-0.5 font-mono text-[13px] text-[#e5c07b]"
                  >
                    {token.content}
                  </code>
                );
              }

              if (token.type === "spoiler") {
                return (
                  <SpoilerSpan
                    key={`spoiler-${tokenIdx}`}
                    text={token.content}
                  />
                );
              }

              if (token.type === "link") {
                return (
                  <a
                    key={`link-${tokenIdx}`}
                    href={token.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00a8fc] underline decoration-[#00a8fc]/40 underline-offset-2 hover:decoration-[#00a8fc]"
                  >
                    {token.content}
                  </a>
                );
              }

              if (token.type === "mention") {
                const isMe =
                  normalizedCurrent.length > 0 &&
                  token.username.toLowerCase() === normalizedCurrent;

                return (
                  <span
                    key={`mention-${tokenIdx}`}
                    className={`rounded px-1 py-0.5 font-semibold ${
                      isMe
                        ? "bg-amber-400/25 text-amber-200"
                        : "bg-[#5865f2]/25 text-[#c7d0ff]"
                    }`}
                  >
                    @{token.username}
                  </span>
                );
              }

              return <span key={`txt-${tokenIdx}`}>{token.content}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

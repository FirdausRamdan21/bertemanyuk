import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BertemanYuk — Ruang Chat Real-Time Komunitas",
  description:
    "Aplikasi chat real-time komunitas bergaya Mini-Discord dengan Next.js App Router dan Supabase Realtime.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#1e1f22] text-[#f2f3f5] font-sans selection:bg-[#5865f2]/40 selection:text-white">
        {children}
      </body>
    </html>
  );
}

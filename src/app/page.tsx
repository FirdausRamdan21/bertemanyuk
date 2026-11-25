import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function HomeRedirect(): Promise<never> {
  if (!isSupabaseConfigured()) {
    return redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect("/chat");
  }

  return redirect("/login");
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] text-sm text-[#949ba4]">
          Memuat sesi...
        </main>
      }
    >
      <HomeRedirect />
    </Suspense>
  );
}

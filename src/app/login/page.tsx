import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const isConfigured = isSupabaseConfigured();

  return (
    <LoginForm
      isConfigured={isConfigured}
      initialError={params.error}
    />
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthShell
      title="Selamat Datang Kembali"
      subtitle="Masuk untuk bergabung dalam obrolan komunitas real-time."
    >
      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-xl bg-[#2b2d31]" />
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

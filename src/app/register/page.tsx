import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function RegisterPage() {
  const isConfigured = isSupabaseConfigured();

  return (
    <AuthShell
      title="Buat Akun Baru"
      subtitle="Atur username kamu dan mulai berdiskusi di channel komunitas."
    >
      <RegisterForm isConfigured={isConfigured} />
    </AuthShell>
  );
}

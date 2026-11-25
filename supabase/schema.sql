-- =============================================================================
-- SKEMA DATABASE BERTEMANYUK (MINI-DISCORD) - FASE 1
-- Jalankan seluruh skrip ini di Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Tabel Profil Pengguna (terhubung langsung ke auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Channel Diskusi
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Pesan
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk performa query pesan & relasi
CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at
  ON public.messages (channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
  ON public.messages (reply_to_id);

-- =============================================================================
-- TRIGGER AUTO-CREATE PROFIL SAAT PENGGUNA MENDAFTAR (EMAIL / OAUTH)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name TEXT;
  base_username TEXT;
  candidate_username TEXT;
  avatar TEXT;
  attempt INTEGER := 0;
BEGIN
  raw_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'user_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'preferred_username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'member'
  );

  -- Sanitasi menjadi huruf kecil, angka, dan underscore
  base_username := regexp_replace(lower(raw_name), '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);

  IF length(base_username) < 3 THEN
    base_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;

  base_username := substr(base_username, 1, 20);
  candidate_username := base_username;

  -- Pastikan username unik agar registrasi Email/OAuth tidak pernah gagal
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username) LOOP
    attempt := attempt + 1;
    IF attempt = 1 THEN
      candidate_username := substr(base_username, 1, 17) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 6);
    ELSE
      candidate_username := substr(base_username, 1, 15) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    END IF;
  END LOOP;

  avatar := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'picture'), '')
  );

  INSERT INTO public.profiles (id, username, avatar_url, role)
  VALUES (NEW.id, candidate_username, avatar, 'MEMBER')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- HELPER ADMIN & ROW LEVEL SECURITY (RLS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS: profiles
DROP POLICY IF EXISTS "Profil dapat dilihat pengguna terautentikasi" ON public.profiles;
CREATE POLICY "Profil dapat dilihat pengguna terautentikasi"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Pengguna dapat membuat profil miliknya sendiri" ON public.profiles;
CREATE POLICY "Pengguna dapat membuat profil miliknya sendiri"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'MEMBER');

DROP POLICY IF EXISTS "Pengguna dapat memperbarui profil miliknya tanpa ubah role" ON public.profiles;
CREATE POLICY "Pengguna dapat memperbarui profil miliknya tanpa ubah role"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Kebijakan RLS: channels
DROP POLICY IF EXISTS "Channel dapat dilihat pengguna terautentikasi" ON public.channels;
CREATE POLICY "Channel dapat dilihat pengguna terautentikasi"
  ON public.channels
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Hanya admin yang dapat membuat channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat membuat channel"
  ON public.channels
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Hanya admin yang dapat mengubah channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat mengubah channel"
  ON public.channels
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Hanya admin yang dapat menghapus channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat menghapus channel"
  ON public.channels
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Kebijakan RLS: messages
DROP POLICY IF EXISTS "Pesan dapat dilihat pengguna terautentikasi" ON public.messages;
CREATE POLICY "Pesan dapat dilihat pengguna terautentikasi"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Pengguna dapat mengirim pesan atas namanya sendiri" ON public.messages;
CREATE POLICY "Pengguna dapat mengirim pesan atas namanya sendiri"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat menghapus pesan" ON public.messages;
CREATE POLICY "Pemilik pesan atau admin dapat menghapus pesan"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- =============================================================================
-- REALTIME REPLICATION
-- =============================================================================

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'channels'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
    END IF;
  END IF;
END
$$;

-- =============================================================================
-- SEED CHANNEL AWAL
-- =============================================================================

INSERT INTO public.channels (name, description)
VALUES
  ('general', 'Ruang obrolan umum untuk seluruh anggota komunitas.'),
  ('ngoding', 'Diskusi pemrograman, bug, arsitektur, dan tips teknis.'),
  ('santai', 'Obrolan santai di luar topik kerja atau koding.')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- CATATAN PROMOSI ADMIN:
-- Setelah akun pertama selesai mendaftar, jadikan ADMIN dengan menjalankan:
-- UPDATE public.profiles SET role = 'ADMIN' WHERE username = 'username_anda';
-- =============================================================================

-- =============================================================================
-- FASE 2: BOOKMARK PRIBADI, HIGHLIGHTS (SOLUSI), & QUICK POLL
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_bookmarks (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user_created
  ON public.message_bookmarks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.message_highlights (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  highlighted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_highlights_channel_created
  ON public.message_highlights (channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE UNIQUE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id
  ON public.poll_votes (poll_id);

ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengguna dapat melihat bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat melihat bookmark miliknya"
  ON public.message_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat menambah bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat menambah bookmark miliknya"
  ON public.message_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat menghapus bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat menghapus bookmark miliknya"
  ON public.message_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Highlights dapat dilihat pengguna terautentikasi" ON public.message_highlights;
CREATE POLICY "Highlights dapat dilihat pengguna terautentikasi"
  ON public.message_highlights FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat menandai solusi" ON public.message_highlights;
CREATE POLICY "Pemilik pesan atau admin dapat menandai solusi"
  ON public.message_highlights FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = highlighted_by
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat melepas tanda solusi" ON public.message_highlights;
CREATE POLICY "Pemilik pesan atau admin dapat melepas tanda solusi"
  ON public.message_highlights FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Poll dapat dilihat pengguna terautentikasi" ON public.polls;
CREATE POLICY "Poll dapat dilihat pengguna terautentikasi"
  ON public.polls FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Pemilik pesan dapat membuat poll" ON public.polls;
CREATE POLICY "Pemilik pesan dapat membuat poll"
  ON public.polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Vote poll dapat dilihat pengguna terautentikasi" ON public.poll_votes;
CREATE POLICY "Vote poll dapat dilihat pengguna terautentikasi"
  ON public.poll_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Pengguna dapat memberikan vote" ON public.poll_votes;
CREATE POLICY "Pengguna dapat memberikan vote"
  ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat mengubah vote miliknya" ON public.poll_votes;
CREATE POLICY "Pengguna dapat mengubah vote miliknya"
  ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat membatalkan vote miliknya" ON public.poll_votes;
CREATE POLICY "Pengguna dapat membatalkan vote miliknya"
  ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_highlights'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_highlights;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'polls'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poll_votes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
    END IF;
  END IF;
END
$$;

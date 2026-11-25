-- =============================================================================
-- MIGRASI FASE 2: BOOKMARK PRIBADI, HIGHLIGHTS (SOLUSI), & QUICK POLL
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor jika Anda sudah
-- menjalankan supabase/schema.sql pada Fase 1.
-- =============================================================================

-- 1. Tabel Bookmark Pribadi ("Saku Pesan")
CREATE TABLE IF NOT EXISTS public.message_bookmarks (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user_created
  ON public.message_bookmarks (user_id, created_at DESC);

-- 2. Tabel Channel Highlights ("Keputusan / Solusi")
CREATE TABLE IF NOT EXISTS public.message_highlights (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  highlighted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_highlights_channel_created
  ON public.message_highlights (channel_id, created_at DESC);

-- 3. Tabel Quick Poll & Voting
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

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) FASE 2
-- =============================================================================

ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS: message_bookmarks (khusus pemilik bookmark)
DROP POLICY IF EXISTS "Pengguna dapat melihat bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat melihat bookmark miliknya"
  ON public.message_bookmarks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat menambah bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat menambah bookmark miliknya"
  ON public.message_bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat menghapus bookmark miliknya" ON public.message_bookmarks;
CREATE POLICY "Pengguna dapat menghapus bookmark miliknya"
  ON public.message_bookmarks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Kebijakan RLS: message_highlights (dilihat semua member; ditandai oleh pemilik pesan atau admin)
DROP POLICY IF EXISTS "Highlights dapat dilihat pengguna terautentikasi" ON public.message_highlights;
CREATE POLICY "Highlights dapat dilihat pengguna terautentikasi"
  ON public.message_highlights
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat menandai solusi" ON public.message_highlights;
CREATE POLICY "Pemilik pesan atau admin dapat menandai solusi"
  ON public.message_highlights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = highlighted_by
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.id = message_id
          AND m.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat melepas tanda solusi" ON public.message_highlights;
CREATE POLICY "Pemilik pesan atau admin dapat melepas tanda solusi"
  ON public.message_highlights
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_id
        AND m.user_id = auth.uid()
    )
  );

-- Kebijakan RLS: polls
DROP POLICY IF EXISTS "Poll dapat dilihat pengguna terautentikasi" ON public.polls;
CREATE POLICY "Poll dapat dilihat pengguna terautentikasi"
  ON public.polls
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Pemilik pesan dapat membuat poll" ON public.polls;
CREATE POLICY "Pemilik pesan dapat membuat poll"
  ON public.polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_id
        AND m.user_id = auth.uid()
    )
  );

-- Kebijakan RLS: poll_votes
DROP POLICY IF EXISTS "Vote poll dapat dilihat pengguna terautentikasi" ON public.poll_votes;
CREATE POLICY "Vote poll dapat dilihat pengguna terautentikasi"
  ON public.poll_votes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Pengguna dapat memberikan vote" ON public.poll_votes;
CREATE POLICY "Pengguna dapat memberikan vote"
  ON public.poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat mengubah vote miliknya" ON public.poll_votes;
CREATE POLICY "Pengguna dapat mengubah vote miliknya"
  ON public.poll_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pengguna dapat membatalkan vote miliknya" ON public.poll_votes;
CREATE POLICY "Pengguna dapat membatalkan vote miliknya"
  ON public.poll_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- PERSIAPAN REALTIME UNTUK FASE 3 (POLLS, VOTES, & HIGHLIGHTS)
-- =============================================================================

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

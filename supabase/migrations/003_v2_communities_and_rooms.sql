-- =============================================================================
-- MIGRASI BERTEMANYUK v2.0 (TAHAP 1):
-- MULTI-KOMUNITAS, SISTEM PERAN, 3 JENIS RUANG, & STORAGE MEDIA (MAKS 2 MB)
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Tabel Komunitas
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Peran di Dalam Komunitas (Pemilik, Pengurus, Anggota, + Peran Kustom)
CREATE TABLE IF NOT EXISTS public.community_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_community BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_roles BOOLEAN NOT NULL DEFAULT FALSE,
  can_create_room BOOLEAN NOT NULL DEFAULT FALSE,
  can_update_room BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete_room BOOLEAN NOT NULL DEFAULT FALSE,
  can_moderate_members BOOLEAN NOT NULL DEFAULT FALSE,
  can_send_messages BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_community_roles_community
  ON public.community_roles (community_id);

-- 3. Tabel Keanggotaan Komunitas
CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.community_roles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_user
  ON public.community_members (user_id);

-- 4. Upgrade Tabel channels menjadi Ruang (3 Jenis: Ruang Obrolan, Ruang Suara, Ruang Koleksi)
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS parent_collection_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_member_messages BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"tabs":{"links":true,"code":true,"bookmarks":true,"solutions":true,"media":true}}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_room_type_check'
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_room_type_check CHECK (room_type IN ('chat', 'voice', 'collection'));
  END IF;
END
$$;

-- Ganti constraint UNIQUE global nama channel menjadi unik per Komunitas
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_community_name_unique
  ON public.channels (community_id, name)
  WHERE community_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channels_community_type
  ON public.channels (community_id, room_type, name);

-- 5. Tabel Izin Akses per Ruang (untuk mode privat & pengaturan anggota di Tahap 2)
CREATE TABLE IF NOT EXISTS public.room_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.community_roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_send BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role_id IS NOT NULL OR user_id IS NOT NULL)
);

-- 6. Upgrade Tabel messages untuk Lampiran Media (Maks 1 gambar / pesan, <= 2 MB)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- =============================================================================
-- TRIGGER OTOMATIS SAAT KOMUNITAS BARU DIBUAT:
-- - Buat 3 peran bawaan: Pemilik, Pengurus, Anggota
-- - Masukkan pembuat sebagai Pemilik
-- - Buat 1 Ruang Obrolan ('obrolan-utama') + 1 Ruang Suara ('ruang-suara')
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_community()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_role_id UUID;
BEGIN
  INSERT INTO public.community_roles (
    community_id, name, slug, is_system,
    can_manage_community, can_manage_roles,
    can_create_room, can_update_room, can_delete_room,
    can_moderate_members, can_send_messages
  )
  VALUES (
    NEW.id, 'Pemilik', 'owner', TRUE,
    TRUE, TRUE,
    TRUE, TRUE, TRUE,
    TRUE, TRUE
  )
  RETURNING id INTO owner_role_id;

  INSERT INTO public.community_roles (
    community_id, name, slug, is_system,
    can_manage_community, can_manage_roles,
    can_create_room, can_update_room, can_delete_room,
    can_moderate_members, can_send_messages
  )
  VALUES
    (
      NEW.id, 'Pengurus', 'moderator', TRUE,
      FALSE, FALSE,
      TRUE, TRUE, FALSE,
      TRUE, TRUE
    ),
    (
      NEW.id, 'Anggota', 'member', TRUE,
      FALSE, FALSE,
      FALSE, FALSE, FALSE,
      FALSE, TRUE
    )
  ON CONFLICT (community_id, slug) DO NOTHING;

  INSERT INTO public.community_members (community_id, user_id, role_id)
  VALUES (NEW.id, NEW.owner_id, owner_role_id)
  ON CONFLICT (community_id, user_id) DO NOTHING;

  INSERT INTO public.channels (community_id, name, description, room_type, created_by)
  VALUES
    (
      NEW.id,
      'obrolan-utama',
      'Ruang obrolan utama untuk berdiskusi dan berbagi informasi.',
      'chat',
      NEW.owner_id
    ),
    (
      NEW.id,
      'ruang-suara',
      'Ruang panggilan suara bersama anggota komunitas.',
      'voice',
      NEW.owner_id
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_community_created ON public.communities;
CREATE TRIGGER on_community_created
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_community();

-- =============================================================================
-- FUNGSI HELPER KEAMANAN & GABUNG KOMUNITAS VIA KODE UNDANGAN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_community_member(target_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = target_community_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_community_permission(target_community_id UUID, perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members cm
    JOIN public.community_roles cr ON cr.id = cm.role_id
    WHERE cm.community_id = target_community_id
      AND cm.user_id = auth.uid()
      AND (
        (perm = 'manage_community' AND cr.can_manage_community) OR
        (perm = 'manage_roles' AND cr.can_manage_roles) OR
        (perm = 'create_room' AND cr.can_create_room) OR
        (perm = 'update_room' AND cr.can_update_room) OR
        (perm = 'delete_room' AND cr.can_delete_room) OR
        (perm = 'moderate_members' AND cr.can_moderate_members) OR
        (perm = 'send_messages' AND cr.can_send_messages)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.join_community_by_code(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_community_id UUID;
  member_role_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  SELECT id INTO target_community_id
  FROM public.communities
  WHERE upper(invite_code) = upper(trim(p_invite_code))
  LIMIT 1;

  IF target_community_id IS NULL THEN
    RAISE EXCEPTION 'Kode undangan komunitas tidak ditemukan.';
  END IF;

  SELECT id INTO member_role_id
  FROM public.community_roles
  WHERE community_id = target_community_id
    AND slug = 'member'
  LIMIT 1;

  INSERT INTO public.community_members (community_id, user_id, role_id)
  VALUES (target_community_id, auth.uid(), member_role_id)
  ON CONFLICT (community_id, user_id) DO NOTHING;

  RETURN target_community_id;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) v2.0
-- =============================================================================

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_permissions ENABLE ROW LEVEL SECURITY;

-- communities
DROP POLICY IF EXISTS "Anggota dapat melihat komunitasnya" ON public.communities;
CREATE POLICY "Anggota dapat melihat komunitasnya"
  ON public.communities FOR SELECT TO authenticated
  USING (public.is_community_member(id) OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Pengguna dapat membuat komunitas baru" ON public.communities;
CREATE POLICY "Pengguna dapat membuat komunitas baru"
  ON public.communities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Pemilik dapat memperbarui komunitas" ON public.communities;
CREATE POLICY "Pemilik dapat memperbarui komunitas"
  ON public.communities FOR UPDATE TO authenticated
  USING (public.has_community_permission(id, 'manage_community') OR owner_id = auth.uid())
  WITH CHECK (public.has_community_permission(id, 'manage_community') OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Pemilik dapat menghapus komunitas" ON public.communities;
CREATE POLICY "Pemilik dapat menghapus komunitas"
  ON public.communities FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- community_roles
DROP POLICY IF EXISTS "Anggota dapat melihat peran di komunitasnya" ON public.community_roles;
CREATE POLICY "Anggota dapat melihat peran di komunitasnya"
  ON public.community_roles FOR SELECT TO authenticated
  USING (public.is_community_member(community_id) OR public.is_admin());

DROP POLICY IF EXISTS "Pemilik dapat membuat peran komunitas" ON public.community_roles;
CREATE POLICY "Pemilik dapat membuat peran komunitas"
  ON public.community_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_community_permission(community_id, 'manage_roles'));

DROP POLICY IF EXISTS "Pemilik dapat mengubah peran komunitas" ON public.community_roles;
CREATE POLICY "Pemilik dapat mengubah peran komunitas"
  ON public.community_roles FOR UPDATE TO authenticated
  USING (public.has_community_permission(community_id, 'manage_roles'))
  WITH CHECK (public.has_community_permission(community_id, 'manage_roles'));

DROP POLICY IF EXISTS "Pemilik dapat menghapus peran kustom" ON public.community_roles;
CREATE POLICY "Pemilik dapat menghapus peran kustom"
  ON public.community_roles FOR DELETE TO authenticated
  USING (public.has_community_permission(community_id, 'manage_roles') AND is_system = FALSE);

-- community_members
DROP POLICY IF EXISTS "Anggota dapat melihat daftar anggota komunitas" ON public.community_members;
CREATE POLICY "Anggota dapat melihat daftar anggota komunitas"
  ON public.community_members FOR SELECT TO authenticated
  USING (public.is_community_member(community_id) OR public.is_admin());

DROP POLICY IF EXISTS "Pemilik dapat mengubah peran anggota" ON public.community_members;
CREATE POLICY "Pemilik dapat mengubah peran anggota"
  ON public.community_members FOR UPDATE TO authenticated
  USING (public.has_community_permission(community_id, 'manage_roles'))
  WITH CHECK (public.has_community_permission(community_id, 'manage_roles'));

DROP POLICY IF EXISTS "Anggota dapat keluar atau dikeluarkan pengurus" ON public.community_members;
CREATE POLICY "Anggota dapat keluar atau dikeluarkan pengurus"
  ON public.community_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_community_permission(community_id, 'moderate_members')
  );

-- Perbarui kebijakan RLS channels agar mengikuti peran Pemilik & Pengurus di Komunitas
DROP POLICY IF EXISTS "Channel dapat dilihat pengguna terautentikasi" ON public.channels;
CREATE POLICY "Channel dapat dilihat pengguna terautentikasi"
  ON public.channels FOR SELECT TO authenticated
  USING (
    community_id IS NULL
    OR public.is_community_member(community_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Hanya admin yang dapat membuat channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat membuat channel"
  ON public.channels FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (community_id IS NOT NULL AND public.has_community_permission(community_id, 'create_room'))
  );

DROP POLICY IF EXISTS "Hanya admin yang dapat mengubah channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat mengubah channel"
  ON public.channels FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (community_id IS NOT NULL AND public.has_community_permission(community_id, 'update_room'))
  )
  WITH CHECK (
    public.is_admin()
    OR (community_id IS NOT NULL AND public.has_community_permission(community_id, 'update_room'))
  );

DROP POLICY IF EXISTS "Hanya admin yang dapat menghapus channel" ON public.channels;
CREATE POLICY "Hanya admin yang dapat menghapus channel"
  ON public.channels FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (community_id IS NOT NULL AND public.has_community_permission(community_id, 'delete_room'))
  );

-- Perbarui kebijakan hapus pesan agar Pengurus & Pemilik komunitas juga bisa moderasi
DROP POLICY IF EXISTS "Pemilik pesan atau admin dapat menghapus pesan" ON public.messages;
CREATE POLICY "Pemilik pesan atau admin dapat menghapus pesan"
  ON public.messages FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id = channel_id
        AND c.community_id IS NOT NULL
        AND public.has_community_permission(c.community_id, 'moderate_members')
    )
  );

-- room_permissions
DROP POLICY IF EXISTS "Anggota dapat melihat izin ruang" ON public.room_permissions;
CREATE POLICY "Anggota dapat melihat izin ruang"
  ON public.room_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = room_id AND (c.community_id IS NULL OR public.is_community_member(c.community_id))
    )
  );

DROP POLICY IF EXISTS "Pengurus dan pemilik dapat mengelola izin ruang" ON public.room_permissions;
CREATE POLICY "Pengurus dan pemilik dapat mengelola izin ruang"
  ON public.room_permissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = room_id AND c.community_id IS NOT NULL
        AND public.has_community_permission(c.community_id, 'update_room')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = room_id AND c.community_id IS NOT NULL
        AND public.has_community_permission(c.community_id, 'update_room')
    )
  );

-- =============================================================================
-- MIGRASI DATA LAMA (FASE 1–4) KE KOMUNITAS UTAMA OTOMATIS
-- =============================================================================

DO $$
DECLARE
  first_owner UUID;
  default_comm_id UUID;
  member_role_id UUID;
BEGIN
  SELECT id INTO first_owner
  FROM public.profiles
  ORDER BY (role = 'ADMIN') DESC, created_at ASC
  LIMIT 1;

  IF first_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.communities) THEN
    INSERT INTO public.communities (name, description, owner_id)
    VALUES (
      'Komunitas Utama',
      'Komunitas bawaan BertemanYuk untuk seluruh anggota.',
      first_owner
    )
    RETURNING id INTO default_comm_id;

    UPDATE public.channels
    SET community_id = default_comm_id
    WHERE community_id IS NULL;

    SELECT id INTO member_role_id
    FROM public.community_roles
    WHERE community_id = default_comm_id AND slug = 'member'
    LIMIT 1;

    INSERT INTO public.community_members (community_id, user_id, role_id)
    SELECT default_comm_id, p.id, member_role_id
    FROM public.profiles p
    WHERE p.id <> first_owner
    ON CONFLICT (community_id, user_id) DO NOTHING;
  END IF;
END
$$;

-- =============================================================================
-- SUPABASE STORAGE BUCKET UNTUK MEDIA RUANG OBROLAN (MAKS 2 MB)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Media obrolan dapat dilihat publik" ON storage.objects;
CREATE POLICY "Media obrolan dapat dilihat publik"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Pengguna terautentikasi dapat mengunggah media obrolan" ON storage.objects;
CREATE POLICY "Pengguna terautentikasi dapat mengunggah media obrolan"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Pengguna dapat menghapus media miliknya" ON storage.objects;
CREATE POLICY "Pengguna dapat menghapus media miliknya"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- AKTIFKAN REALTIME UNTUK TABEL KOMUNITAS & PERAN
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'communities'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.communities;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_roles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_roles;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members;
    END IF;
  END IF;
END
$$;

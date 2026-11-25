# BertemanYuk — Aplikasi Chat Real-Time (Mini-Discord)

Aplikasi ruang diskusi komunitas bergaya Mini-Discord yang dibangun dengan **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase (Auth + PostgreSQL + Realtime)** tanpa perlu mengelola server WebSocket mandiri.

---

## Fitur Utama (MVP v1.0 — Lengkap Fase 1–4)

### Autentikasi & Keamanan
- **Login & Register** via Email/Password serta **OAuth Google & GitHub** (`/auth/callback` PKCE).
- **Auto-Create Profil** otomatis via trigger PostgreSQL `handle_new_user()` + edit username & avatar.
- **Row Level Security (RLS)** penuh untuk peran `MEMBER` dan `ADMIN`.

### Layout 3 Kolom & Fitur Chat Pembeda
- **Antarmuka 3 Kolom Responsif** (Sidebar Channel kiri, Area Chat tengah, Sidebar Anggota kanan + drawer mobile).
- **CRUD Channel Lengkap (Admin)**: buat, ubah nama/deskripsi, dan hapus channel secara *real-time*.
- **Balas (*Reply*) & Moderasi Pesan**: klik kutipan balasan untuk melompat ke pesan asli; hapus pesan sendiri atau moderasi oleh Admin.
- **Teks Spoiler (`||blur||`) & Format Blok Kode** (`` `inline` `` & ` ```blok kode``` ` dengan tombol salin + auto-link).
- **Filter Cepat Channel** (`Semua`, `Link`, `Kode`, `Saku Pesan`, `Solusi`) + pencarian teks di channel aktif.
- **Saku Pesan (Bookmark Pribadi)** khusus per pengguna.
- **Tandai "Solusi / Keputusan"** + **Ekspor Ringkasan Solusi ke Markdown (`.md`)** dengan 1 klik.
- **Quick Poll / Voting Instan** lewat tombol Quick Poll atau slash command `/poll Pertanyaan? | Opsi 1 | Opsi 2`.
- **Mention `@username` Autocomplete** (anggota Online diprioritaskan di atas) + sorotan khusus saat kamu di-mention.
- **Mode Tampilan Nyaman (*Cozy*) / Ringkas (*Compact*)** & **Smart Auto-Scroll** dengan pil melayang `"↓ X pesan baru"`.

### 3 Pilar Supabase Realtime
- **Postgres Changes**: pesan masuk/hapus instan, live Quick Poll & vote, tanda Solusi, sinkronisasi channel Admin, serta **Badge Unread antar Channel + Suara Ping Web Audio** (dengan tombol *Mute/Unmute*).
- **Broadcast**: **Smart Typing Indicator** kontekstual (*sedang mengetik...* / *sedang menulis kode...* / *sedang menyiapkan poll...*).
- **Presence**: status **Online/Offline** otomatis, **Custom Vibe Status** (`💻 Lagi ngoding`, `☕ Lagi ngopi`, dll.), dan tumpukan avatar **"Sedang di channel ini"** di header.

---

## Panduan Setup Lokal

### 1. Install Dependensi & Salin Environment Variables

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local` dari **Supabase Dashboard → Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Jalankan Skema Database & RLS

- **Instalasi baru**: jalankan seluruh [`supabase/schema.sql`](./supabase/schema.sql) di **Supabase Dashboard → SQL Editor**.
- **Upgrade dari Fase 1**: jalankan [`supabase/migrations/002_phase2_features.sql`](./supabase/migrations/002_phase2_features.sql) di **SQL Editor**.

### 3. Konfigurasi OAuth Google & GitHub (Opsional)

1. Di **Supabase Dashboard → Authentication → URL Configuration**, tambahkan Redirect URL:
   - `http://localhost:3000/auth/callback`
2. Aktifkan **Google** dan/atau **GitHub** di **Authentication → Providers**.

### 4. Menjadikan Akun Pertama sebagai Admin

```sql
UPDATE public.profiles
SET role = 'ADMIN'
WHERE username = 'username_anda';
```

### 5. Jalankan Dev Server

```bash
npm run dev
```

> **Catatan Windows PowerShell:** Jika eksekusi `.ps1` diblokir oleh Execution Policy, gunakan `npm.cmd run dev`.

---

## Panduan Deploy ke Vercel

1. **Push kode ke GitHub** (pastikan `.env.local` tidak ikut ter-commit; sudah diabaikan di `.gitignore`).
2. Buka [vercel.com/new](https://vercel.com/new), impor repositori `bertemanyuk`.
3. Pada bagian **Environment Variables** di Vercel, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Klik **Deploy** dan tunggu hingga domain produksi aktif (misalnya `https://bertemanyuk.vercel.app`).
5. **Wajib untuk Auth Produksi**: buka **Supabase Dashboard → Authentication → URL Configuration**:
   - Ubah **Site URL** menjadi `https://bertemanyuk.vercel.app`.
   - Tambahkan `https://bertemanyuk.vercel.app/auth/callback` ke **Redirect URLs**.
6. Uji login, kirim pesan di dua perangkat, dan pastikan badge **`Live`** berwarna hijau di header channel.

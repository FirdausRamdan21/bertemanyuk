let audioCtx: AudioContext | null = null;

/**
 * Memutar suara ping notifikasi yang lembut menggunakan Web Audio API
 * tanpa memerlukan file audio eksternal.
 */
export function playNotificationPing(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.14);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    // Abaikan jika browser memblokir autoplay audio sebelum interaksi pengguna
  }
}

export const VIBE_PRESETS = [
  "💻 Lagi ngoding",
  "☕ Lagi ngopi",
  "🎮 Cari mabar",
  "🎧 Dengerin musik",
  "🔕 Mode fokus",
] as const;

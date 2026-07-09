/**
 * Player-facing audio preferences (0..1), shared by the React sliders and
 * the game's music/SFX players. Persisted per browser in localStorage and
 * mirrored across tabs via the storage event, so both dimensions follow the
 * same sliders.
 */
export interface AudioSettings {
  music: number
  sfx: number
}

const STORAGE_KEY = 'gloria.audio'
const DEFAULTS: AudioSettings = { music: 0.8, sfx: 0.8 }

type Listener = (settings: AudioSettings) => void
const listeners = new Set<Listener>()

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      music: clamp01(typeof parsed.music === 'number' ? parsed.music : DEFAULTS.music),
      sfx: clamp01(typeof parsed.sfx === 'number' ? parsed.sfx : DEFAULTS.sfx),
    }
  } catch {
    return { ...DEFAULTS } // no storage (tests, private mode) — use defaults
  }
}

let current: AudioSettings = load()

function notify(): void {
  listeners.forEach((listener) => listener(current))
}

// The other tab moved a slider: adopt its value here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    current = load()
    notify()
  })
}

export function getAudioSettings(): AudioSettings {
  return current
}

export function setAudioSetting(kind: keyof AudioSettings, value: number): void {
  current = { ...current, [kind]: clamp01(value) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage may be unavailable; the in-memory value still applies.
  }
  notify()
}

export function subscribeAudioSettings(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

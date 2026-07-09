import type Phaser from 'phaser'
import { getAudioSettings } from '../../lib/audioSettings'

/** Short effects, decoded once at boot into the game-wide audio cache. */
export const SFX = {
  meleeWhoosh: { key: 'sfx-melee-whoosh', url: '/sfx/sword-whoosh.wav' },
} as const

export function preloadSfx(scene: Phaser.Scene): void {
  for (const { key, url } of Object.values(SFX)) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, url)
  }
}

/**
 * Fire-and-forget effect at the SFX slider's volume. Each call spawns its
 * own sound instance, so rapid attacks overlap instead of cutting each other
 * short. Only the visible dimension is audible — replayed remote actions on
 * the hidden tab would otherwise double every sound.
 */
export function playSfx(scene: Phaser.Scene, key: string): void {
  if (document.hidden) return
  const volume = getAudioSettings().sfx
  if (volume <= 0) return
  scene.sound.play(key, { volume })
}

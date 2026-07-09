import Phaser from 'phaser'
import type { TabId } from '../sync/messages'

/**
 * Cinematic clips. Each dimension gets its own intro; the endscreen is
 * shared. `durationMs` is the clip's authored length and is what actually
 * times the cinematic — keep it in sync when swapping footage. Keep files
 * faststart .mp4 — Phaser's loader rejects .mov by extension (crashes the
 * scene), and a trailing moov atom stalls streamed playback.
 */
export const INTRO_VIDEOS: Record<TabId, { key: string; url: string; durationMs: number }> = {
  1: { key: 'cinematic-intro-sirius', url: '/videos/sirius-intro.mp4', durationMs: 8670 },
  2: { key: 'cinematic-intro-orion', url: '/videos/orion-intro.mp4', durationMs: 8670 },
}
export const ENDSCREEN_VIDEO =
  { key: 'cinematic-endscreen', url: '/videos/sirius-orion-outro.mp4', durationMs: 16080 }

const FLASH_MS = 400
const LINE_FADE_MS = 1000

/**
 * Streams this dimension's clips into the browser's HTTP cache during the
 * intermission, so a first-ever playthrough on a cold machine doesn't
 * stutter its cinematics while ~80MB trickles in mid-scene. The video
 * elements later replay the same URLs straight from cache. Intro first (it
 * plays first); the shared endscreen is fetched by tab 1 only — the cache
 * is browser-wide, so tab 2's element hits it too. Best-effort: a failed
 * or unfinished warm-up just means the clip streams on demand as before.
 */
let cacheWarmed = false
export function warmCinematicCache(tab: TabId): void {
  if (cacheWarmed) return // intermission restarts must not re-download
  cacheWarmed = true
  const urls = [INTRO_VIDEOS[tab].url]
  if (tab === 1) urls.push(ENDSCREEN_VIDEO.url)
  void (async () => {
    for (const url of urls) {
      try {
        // Drain the stream instead of buffering a blob: the HTTP cache is
        // filled as bytes arrive, and 80MB never sits in JS memory.
        const reader = (await fetch(url)).body?.getReader()
        while (reader && !(await reader.read()).done) { /* draining */ }
      } catch {
        // Preloading is opportunistic; playback still streams on demand.
      }
    }
  })()
}

/**
 * Presentation helpers for the boss room's intro and victory cinematics:
 * full-view video backdrops, twin-colored screen flashes, and line-by-line
 * text reveals. Owns no fight state — the scene drives it.
 */
export class BossCinematics {
  private readonly scene: Phaser.Scene
  private readonly tint: number

  constructor(scene: Phaser.Scene, tint: number) {
    this.scene = scene
    this.tint = tint
  }

  /** Camera flash in the twin's color (jade on Sirius's tab, red on Orion's). */
  flash(): void {
    this.scene.cameras.main.flash(FLASH_MS,
      (this.tint >> 16) & 0xff, (this.tint >> 8) & 0xff, this.tint & 0xff)
  }

  /**
   * Plays the clip once in place of the background (pinned to the camera
   * view, behind the arena), then calls onDone after `durationMs` — the
   * clip's authored length, on the scene clock. The video element is pure
   * best-effort visuals: hidden tabs may refuse to play it at all (both
   * intros still take the same time and the dimensions stay in step), and
   * a missing or broken clip just leaves the plain background.
   */
  playVideo(clip: { key: string; durationMs: number }, onDone: () => void): void {
    const scene = this.scene
    scene.time.delayedCall(clip.durationMs, onDone)
    if (!scene.cache.video.exists(clip.key)) return

    const width = scene.scale.width
    const height = scene.scale.height
    const video = scene.add.video(width / 2, height / 2, clip.key)
      .setScrollFactor(0)
      .setDepth(-5)
    video.setDisplaySize(width, height)
    // The real frame size arrives with the texture; re-stretch to the view.
    video.on('created', () => video.setDisplaySize(width, height))
    const clear = () => {
      if (video.active) video.destroy()
    }
    video.on('complete', clear)
    video.on('error', clear)
    scene.time.delayedCall(clip.durationMs, clear)
    video.play()
  }

  /**
   * Fades `lines` in one after another (the first styled as a heading);
   * `holdMs` after the last line has fully faded in, onDone fires. The
   * lines stay on screen — the scene ends or an overlay covers them.
   */
  fadeInLines(lines: string[], holdMs: number, onDone: () => void): void {
    const scene = this.scene
    const centerX = scene.scale.width / 2
    lines.forEach((line, index) => {
      const heading = index === 0
      const text = scene.add
        .text(centerX, heading ? 170 : 226 + (index - 1) * 34, line, {
          fontSize: heading ? '42px' : '18px',
          color: '#e8e6f0',
          fontStyle: heading ? 'bold' : 'normal',
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScrollFactor(0)
        .setDepth(9)
      scene.tweens.add({
        targets: text,
        alpha: 1,
        duration: LINE_FADE_MS,
        delay: index * LINE_FADE_MS,
        onComplete: index === lines.length - 1
          ? () => scene.time.delayedCall(holdMs, onDone)
          : undefined,
      })
    })
  }
}

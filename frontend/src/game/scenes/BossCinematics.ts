import Phaser from 'phaser'
import type { TabId } from '../sync/messages'

/**
 * Cinematic clips. Each dimension gets its own intro; the endscreen is
 * shared. All three point at the placeholder until the real footage lands —
 * swap the URLs here, nothing else references the files.
 */
export const INTRO_VIDEOS: Record<TabId, { key: string; url: string }> = {
  1: { key: 'cinematic-intro-sirius', url: '/placeholder-video.mp4' },
  2: { key: 'cinematic-intro-orion', url: '/placeholder-video.mp4' },
}
export const ENDSCREEN_VIDEO = { key: 'cinematic-endscreen', url: '/placeholder-video.mp4' }

const FLASH_MS = 400
const LINE_FADE_MS = 1000
/** Failsafe: a clip whose duration never resolves must not stall the fight. */
const VIDEO_FAILSAFE_MS = 20000
/** Clock grace over the clip duration, so a playing video ends itself. */
const CLOCK_SLACK_MS = 250

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
   * view, behind the arena), then calls onDone.
   *
   * The scene clock — not the video element — decides when the cinematic is
   * over: browsers defer muted playback in hidden tabs, but the worker
   * heartbeat keeps stepping a hidden game, so both dimensions run their
   * intros simultaneously whether or not their tab is focused. The element
   * is best-effort visuals on top; a missing or broken clip falls through.
   */
  playVideo(key: string, onDone: () => void): void {
    const scene = this.scene
    if (!scene.cache.video.exists(key)) {
      onDone()
      return
    }
    const width = scene.scale.width
    const height = scene.scale.height
    const video = scene.add.video(width / 2, height / 2, key)
      .setScrollFactor(0)
      .setDepth(-5)
    video.setDisplaySize(width, height)
    // The real frame size arrives with the texture; re-stretch to the view.
    video.on('created', () => video.setDisplaySize(width, height))

    let finished = false
    let clock: Phaser.Time.TimerEvent | undefined
    const finish = () => {
      if (finished) return
      finished = true
      failsafe.remove()
      clock?.remove()
      video.destroy()
      onDone()
    }
    const failsafe = scene.time.delayedCall(VIDEO_FAILSAFE_MS, finish)
    // Arm the master clock as soon as the clip's duration is known.
    const armClock = () => {
      const seconds = video.getDuration()
      if (!clock && Number.isFinite(seconds) && seconds > 0) {
        clock = scene.time.delayedCall(seconds * 1000 + CLOCK_SLACK_MS, finish)
      }
    }
    armClock()
    video.on('metadata', armClock)
    video.on('created', armClock)
    video.on('complete', finish) // a clip that really played ends itself
    video.on('error', finish)
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

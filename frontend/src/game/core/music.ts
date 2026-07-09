import { getAudioSettings, subscribeAudioSettings } from '../../lib/audioSettings'

/** Tracks and cues on the music channel, streamed straight from /public. */
export const MUSIC = {
  intermission: '/songs/sacred-light.mp3',
  bossFight: '/songs/celestial-clash.wav',
  introCue: '/songs/intro-sound.wav',
} as const

/**
 * Celestial Clash's jump map, in seconds. The fight loop plays 0 → mainEnd,
 * jumps to the bridge (bridgeStart → bridgeEnd), then back to 0. Victory
 * jumps to mainEnd and lets the song play its outro to the natural end —
 * one file, dynamic arrangement.
 */
const BOSS_LOOP = {
  mainEnd: 279.66, // 4:39.66
  bridgeStart: 200.38, // 3:20.38
  bridgeEnd: 208.75, // 3:28.75
}

type BossSection = 'main' | 'bridge' | 'outro'

const FADE_OUT_MS = 1500
const FADE_STEP_MS = 60

/**
 * One music track per SESSION: only tab 1 (Sirius's dimension) is the music
 * host — browsers never throttle an unmuted HTMLAudioElement in a background
 * tab, so the song stays audible whichever dimension is focused, and two
 * side-by-side windows can't double it. The element streams (a five-minute
 * song decoded into an AudioBuffer costs ~100MB) and survives scene
 * switches. Volume follows the Music slider live — from either tab, since
 * the settings store mirrors across tabs.
 */
class GameMusic {
  private element?: HTMLAudioElement
  private src = ''
  /** Set while Celestial Clash's jump map is active (undefined = plain loop). */
  private bossSection?: BossSection
  private enabled = true
  private suspended = false
  private fadeFactor = 1
  private fadeTimer: ReturnType<typeof setInterval> | undefined
  private unlockArmed = false

  constructor() {
    if (typeof document !== 'undefined') {
      subscribeAudioSettings(() => this.applyVolume())
      // A play() blocked earlier gets another chance when the tab is shown.
      document.addEventListener('visibilitychange', () => {
        if (this.element?.paused && !this.suspended) this.tryPlay(this.element)
      })
    }
  }

  /** Only the host tab (tab 1) plays music; everyone else's calls no-op. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stop()
  }

  /** Intermission theme: plain loop until another track replaces it. */
  playIntermissionTheme(): void {
    if (!this.enabled) return
    const element = this.swapTo(MUSIC.intermission)
    element.loop = true
    this.bossSection = undefined
    this.tryPlay(element)
  }

  /** One-shot cutscene sound, cut to the intro clips' length. */
  playIntroCue(): void {
    if (!this.enabled) return
    const element = this.swapTo(MUSIC.introCue)
    element.loop = false
    this.bossSection = undefined
    this.tryPlay(element)
  }

  /** Fight theme, from the top; drive update() to run the jump map. */
  playBossTheme(): void {
    if (!this.enabled) return
    const element = this.swapTo(MUSIC.bossFight)
    element.loop = false
    this.bossSection = 'main'
    this.tryPlay(element)
  }

  /** Call from the boss scene's update loop: executes the jump map. */
  update(): void {
    const element = this.element
    if (!element || !this.bossSection || element.paused) return
    const seconds = element.currentTime
    if (this.bossSection === 'main' && seconds >= BOSS_LOOP.mainEnd) {
      element.currentTime = BOSS_LOOP.bridgeStart
      this.bossSection = 'bridge'
    } else if (this.bossSection === 'bridge' && seconds >= BOSS_LOOP.bridgeEnd) {
      element.currentTime = 0
      this.bossSection = 'main'
    }
    // 'outro' takes no jumps — the song ends itself.
  }

  /** The twins fell: jump to the outro, let the song end, then settle back
   *  into the calm intermission theme for players who linger. */
  playBossOutro(): void {
    const element = this.element
    if (!element || !this.bossSection) return
    this.bossSection = 'outro'
    element.currentTime = BOSS_LOOP.mainEnd
    element.addEventListener('ended', () => {
      if (this.element === element && this.bossSection === 'outro') {
        this.playIntermissionTheme()
      }
    }, { once: true })
    this.tryPlay(element)
  }

  /** Defeat and scene exits: ease the track out instead of cutting it. */
  fadeOut(ms = FADE_OUT_MS): void {
    if (!this.element || this.fadeTimer) return
    const step = FADE_STEP_MS / ms
    this.fadeTimer = setInterval(() => {
      this.fadeFactor = Math.max(0, this.fadeFactor - step)
      this.applyVolume()
      if (this.fadeFactor === 0) this.stop()
    }, FADE_STEP_MS)
  }

  stop(): void {
    this.clearFade()
    this.element?.pause()
    this.element = undefined
    this.src = ''
    this.bossSection = undefined
  }

  /** Terminal overlays (logged out, session sealed) silence the music. */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    this.applyMute()
    if (!suspended && this.element?.paused && this.src) this.tryPlay(this.element)
  }

  private swapTo(src: string): HTMLAudioElement {
    if (this.element && this.src === src) return this.element
    this.stop()
    const element = new Audio(src)
    element.preload = 'auto'
    this.element = element
    this.src = src
    this.fadeFactor = 1
    this.applyVolume()
    this.applyMute()
    return element
  }

  private tryPlay(element: HTMLAudioElement): void {
    element.play().catch(() => this.armUnlock())
  }

  /** Autoplay was blocked (fresh tab, no gesture yet): retry on first input. */
  private armUnlock(): void {
    if (this.unlockArmed) return
    this.unlockArmed = true
    const unlock = () => {
      this.unlockArmed = false
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      if (this.element?.paused && !this.suspended) {
        this.element.play().catch(() => {})
      }
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  private applyVolume(): void {
    if (!this.element) return
    this.element.volume = getAudioSettings().music * this.fadeFactor
  }

  private applyMute(): void {
    if (!this.element) return
    this.element.muted = this.suspended
  }

  private clearFade(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    this.fadeTimer = undefined
    this.fadeFactor = 1
  }
}

/** The session-wide music channel (one track at a time, hosted by tab 1). */
export const gameMusic = new GameMusic()

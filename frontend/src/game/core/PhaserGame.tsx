import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { IntermissionScene } from '../scenes/IntermissionScene'
import { BossRoomScene } from '../scenes/BossRoomScene'
import { HudScene } from '../scenes/HudScene'
import type { TabSync } from '../sync/TabSync'
import type { IntermissionScene as IntermissionSceneType } from '../scenes/IntermissionScene'

interface PhaserGameProps {
  potions: number
  tabSync: TabSync
  paused?: boolean
  /** Server-confirmed match stats, pushed into the victory endscreen. */
  victoryStats?: { pointsEarned: number; durationMs: number } | null
  onShopOpen: () => void
  onPotionsUsed?: (remaining: number) => void
  onWindup?: (color: string) => void
  onMatchStart?: () => void
  onMatchFinished?: (victory: boolean) => void
  /** Fires on every tab when the fight ends (match:finished is tab 1 only). */
  onFightEnded?: (victory: boolean) => void
  /** The in-game victory send-off finished; the overlay may pop now. */
  onEndscreenDone?: () => void
  onSessionEnded?: (reason: string) => void
}

/** Fixed chunk a hidden game is stepped by, in ms (~20 fps). */
const BACKGROUND_STEP_MS = 50
/** Most elapsed time settled per tick — bounds the catch-up burst after a
 *  stall while keeping the hidden clock glued to real time. */
const MAX_CATCHUP_MS = 1000

/** Mounts the Phaser game and bridges its events into React. */
export default function PhaserGame({
  potions,
  tabSync,
  paused = false,
  victoryStats = null,
  onShopOpen,
  onPotionsUsed,
  onWindup,
  onMatchStart,
  onMatchFinished,
  onFightEnded,
  onEndscreenDone,
  onSessionEnded,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 960,
      height: 540,
      backgroundColor: '#0b0d17',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 1000 } },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, IntermissionScene, BossRoomScene, HudScene],
    })
    game.registry.set('potions', potions)
    game.registry.set('tabsync', tabSync)
    game.events.on('shop:open', onShopOpen)
    if (onPotionsUsed) game.events.on('potions:used', onPotionsUsed)
    if (onWindup) game.events.on('sync:windup', onWindup)
    if (onMatchStart) game.events.on('match:start', onMatchStart)
    if (onMatchFinished) game.events.on('match:finished', onMatchFinished)
    if (onFightEnded) game.events.on('fight:ended', onFightEnded)
    if (onEndscreenDone) game.events.on('endscreen:done', onEndscreenDone)
    if (onSessionEnded) game.events.on('session:ended', onSessionEnded)
    gameRef.current = game

    // Whichever tab the user is looking at controls the character.
    const claim = () => tabSync.claimControl()
    window.addEventListener('focus', claim)
    if (document.hasFocus()) tabSync.claimControl()

    // Presence pings tell the other dimension this tab is still alive.
    tabSync.startPresence()

    // Hidden tabs get no requestAnimationFrame, which froze the puppet
    // dimension until you tabbed back. A worker's timers keep firing while
    // hidden, so we step the game manually from its heartbeat. The same
    // unthrottled clock also drives presence pings while hidden (window
    // intervals slow to a crawl in background tabs).
    //
    // Ticks from a background renderer arrive late or coalesced (the OS
    // deprioritises the process), and a fixed 50ms per tick loses the
    // difference — the hidden dimension's clock drifted seconds behind the
    // focused one. So each tick settles the real elapsed time instead,
    // stepping it in fixed chunks (debt-capped, so a long stall fast-forwards
    // briefly rather than spiralling).
    const ticker = new Worker('/tick-worker.js')
    let lastTickAt = performance.now()
    let owedMs = 0
    ticker.onmessage = () => {
      tabSync.heartbeat()
      const now = performance.now()
      const elapsed = now - lastTickAt
      lastTickAt = now
      if (document.hidden && !pausedRef.current && gameRef.current) {
        owedMs = Math.min(owedMs + elapsed, MAX_CATCHUP_MS)
        while (owedMs >= BACKGROUND_STEP_MS && gameRef.current) {
          gameRef.current.step(performance.now(), BACKGROUND_STEP_MS)
          owedMs -= BACKGROUND_STEP_MS
        }
      } else {
        owedMs = 0 // visible: rAF owns the clock again
      }
    }

    return () => {
      ticker.terminate()
      window.removeEventListener('focus', claim)
      // destroy() only queues the teardown for the next frame step. A paused
      // game's loop is asleep (no steps ever run), so the queued destroy
      // would never happen — leaving keyboard capture alive on the next
      // page. runDestroy() performs the same teardown synchronously (it is
      // absent from the type definitions but public on the Game instance).
      // A game still booting must not be torn down synchronously (its scene
      // systems don't exist yet); its boot sequence runs the pending destroy.
      // isRunning only turns true after the SceneManager has booted.
      game.destroy(true)
      if (game.isRunning && !game.loop.running) {
        ;(game as unknown as { runDestroy(): void }).runDestroy()
      }
      gameRef.current = null
    }
    // The game is created once; live updates flow through setPotions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    pausedRef.current = paused
    const game = gameRef.current
    if (!game) return
    if (paused) {
      game.loop.sleep()
    } else {
      game.loop.wake()
    }
  }, [paused])

  // The victory endscreen reads the stats from the registry (or catches the
  // event if it is already waiting on them).
  useEffect(() => {
    const game = gameRef.current
    if (!game || !victoryStats) return
    game.registry.set('victory-stats', victoryStats)
    game.events.emit('victory:stats', victoryStats)
  }, [victoryStats])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    game.registry.set('potions', potions)
    const intermission = game.scene.getScene('intermission') as IntermissionSceneType | null
    if (intermission && game.scene.isActive('intermission')) {
      intermission.setPotions(potions)
    }
  }, [potions])

  return <div ref={containerRef} className="game-canvas" />
}

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
  onShopOpen: () => void
  onPotionsUsed?: (remaining: number) => void
  onWindup?: (color: string) => void
  onMatchStart?: () => void
  onMatchFinished?: (victory: boolean) => void
  /** Fires on every tab when the fight ends (match:finished is tab 1 only). */
  onFightEnded?: (victory: boolean) => void
  onSessionEnded?: (reason: string) => void
}

/** How often the worker heartbeat steps a hidden game, in ms (~20 fps). */
const BACKGROUND_STEP_MS = 50

/** Mounts the Phaser game and bridges its events into React. */
export default function PhaserGame({
  potions,
  tabSync,
  paused = false,
  onShopOpen,
  onPotionsUsed,
  onWindup,
  onMatchStart,
  onMatchFinished,
  onFightEnded,
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
    if (onSessionEnded) game.events.on('session:ended', onSessionEnded)
    gameRef.current = game

    // Whichever tab the user is looking at controls the character.
    const claim = () => tabSync.claimControl()
    window.addEventListener('focus', claim)
    if (document.hasFocus()) tabSync.claimControl()

    // Hidden tabs get no requestAnimationFrame, which froze the puppet
    // dimension until you tabbed back. A worker's timers keep firing while
    // hidden, so we step the game manually from its heartbeat.
    const ticker = new Worker('/tick-worker.js')
    ticker.onmessage = () => {
      if (document.hidden && !pausedRef.current && gameRef.current) {
        gameRef.current.step(performance.now(), BACKGROUND_STEP_MS)
      }
    }

    return () => {
      ticker.terminate()
      window.removeEventListener('focus', claim)
      game.destroy(true)
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

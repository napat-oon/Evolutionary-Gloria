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
}

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
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

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
    gameRef.current = game

    // Whichever tab the user is looking at controls the character.
    const claim = () => tabSync.claimControl()
    window.addEventListener('focus', claim)
    if (document.hasFocus()) tabSync.claimControl()

    return () => {
      window.removeEventListener('focus', claim)
      game.destroy(true)
      gameRef.current = null
    }
    // The game is created once; live updates flow through setPotions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
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

import type Phaser from 'phaser'

/**
 * Temporary balance-tuning overlays: outlines every arcade physics body
 * (player, bosses, projectiles, platforms) plus the math-only hitboxes the
 * bosses use (melee ranges, blast radii, the ultimate's dive/safe zones).
 *
 * Toggle with the H key in-game (persisted in localStorage across tabs), or
 * open the game with `?hitboxes=1` / `&hitboxes=1` in the URL.
 */

const STORAGE_KEY = 'gloria-hitbox-debug'

let enabled: boolean | null = null

export function hitboxDebugEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled =
        localStorage.getItem(STORAGE_KEY) === '1' ||
        new URLSearchParams(window.location.search).has('hitboxes')
    } catch {
      enabled = false
    }
  }
  return enabled
}

function setEnabled(value: boolean): void {
  enabled = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* private mode — the in-memory toggle still works */
  }
}

/**
 * Call early in a scene's create() — before physics objects are made, so
 * their bodies pick up the debug flags. Draws body outlines while enabled
 * and binds the H toggle.
 */
export function setupHitboxDebug(scene: Phaser.Scene): void {
  const world = scene.physics.world
  // Bodies copy these flags at creation; set them up-front so a mid-scene
  // toggle can show bodies that were created while the overlay was off.
  world.defaults.debugShowBody = true
  world.defaults.debugShowStaticBody = true
  world.defaults.debugShowVelocity = false

  const apply = (on: boolean) => {
    if (on && !world.debugGraphic) {
      world.createDebugGraphic().setDepth(50)
    }
    world.drawDebug = on
    world.debugGraphic?.setVisible(on)
    if (!on) world.debugGraphic?.clear()
  }
  apply(hitboxDebugEnabled())

  scene.input.keyboard?.addKey('H').on('down', () => {
    setEnabled(!hitboxDebugEnabled())
    apply(hitboxDebugEnabled())
  })
}

/**
 * Outline a hitbox that exists only as math (distance/ellipse checks with no
 * physics body) for `ms` — call it at the moment the check happens.
 */
export function debugHitShape(
  scene: Phaser.Scene,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  ms = 350,
  color = 0xff5cf0,
): void {
  if (!hitboxDebugEnabled()) return
  const g = scene.add.graphics().setDepth(50)
  g.lineStyle(2, color, 0.9)
  draw(g)
  g.strokePath()
  scene.time.delayedCall(ms, () => g.destroy())
}

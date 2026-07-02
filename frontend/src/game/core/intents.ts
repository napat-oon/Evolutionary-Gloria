/** Pure input-intent model: no Phaser imports so it stays unit-testable. */

export type AbilityId =
  | 'star-shotgun'
  | 'water-rush'
  | 'electric-dive'
  | 'fire-plunge'
  | 'dark-swing'
  | 'leaf-blade'
  | 'twin-ribbons'
  | 'icicle-stomp'

/** Snapshot of the inputs that matter when Right Click is pressed. */
export interface CastSnapshot {
  ctrl: boolean
  movingX: boolean
  up: boolean
  down: boolean
}

/**
 * Maps the movement context at cast time to one of the 8 elemental abilities.
 * Priority: vertical inputs beat horizontal movement, standing still is the
 * fallback — mirrors the design spec exactly.
 */
export function selectAbility(snapshot: CastSnapshot): AbilityId {
  if (snapshot.ctrl) {
    if (snapshot.up) return 'twin-ribbons'
    if (snapshot.down) return 'icicle-stomp'
    if (snapshot.movingX) return 'leaf-blade'
    return 'dark-swing'
  }
  if (snapshot.up) return 'electric-dive'
  if (snapshot.down) return 'fire-plunge'
  if (snapshot.movingX) return 'water-rush'
  return 'star-shotgun'
}

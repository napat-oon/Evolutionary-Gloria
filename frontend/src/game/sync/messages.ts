import type { StarColor } from '../bosses/ConstellationTracker'
import type { AbilityId } from '../core/intents'
import type { VitalsSnapshot } from '../player/Vitals'

/** Wire protocol between the two browser tabs. Pure types + guards. */

export type TabId = 1 | 2

export function otherTab(tab: TabId): TabId {
  return tab === 1 ? 2 : 1
}

/** Boss colours per tab: Sirius (tab 1) is jade, Orion (tab 2) is crimson. */
export const TAB_BOSS_COLOR: Record<TabId, string> = {
  1: '#5ad08a',
  2: '#e4556e',
}

export interface PoseMessage {
  type: 'pose'
  tab: TabId
  scene: string
  x: number
  y: number
  facing: 1 | -1
  vitals: VitalsSnapshot
}

export interface CastMessage {
  type: 'cast'
  tab: TabId
  ability: AbilityId
  aim: { x: number; y: number }
  moveDir: -1 | 0 | 1
}

export interface MeleeMessage {
  type: 'melee'
  tab: TabId
  aim: { x: number; y: number }
  comboStep: number
}

/** The boss on `tab` is winding up an attack; the other tab shows the glow. */
export interface WindupMessage {
  type: 'windup'
  tab: TabId
  color: string
}

/** Damage observed on a non-controlling tab, forwarded to the vitals owner. */
export interface DamageMessage {
  type: 'damage'
  tab: TabId
  amount: number
  eventId: string
}

/** Sent when a tab takes control of the character (usually on focus). */
export interface ControlMessage {
  type: 'control'
  tab: TabId
}

/** The twins share one HP pool; the controlling tab broadcasts changes. */
export interface BossHpMessage {
  type: 'boss-hp'
  tab: TabId
  hp: number
  maxHp: number
}

/** A special attack added (or failed to add) a constellation star. */
export interface StarMessage {
  type: 'star'
  tab: TabId
  color: StarColor
  eventId: string
}

/** Fight lifecycle mirrored across tabs. */
export interface FightMessage {
  type: 'fight'
  tab: TabId
  phase: 'intro' | 'start' | 'ultimate' | 'victory' | 'defeat'
}

export type SyncMessage =
  | PoseMessage
  | CastMessage
  | MeleeMessage
  | WindupMessage
  | DamageMessage
  | ControlMessage
  | BossHpMessage
  | StarMessage
  | FightMessage

const MESSAGE_TYPES = new Set([
  'pose', 'cast', 'melee', 'windup', 'damage', 'control', 'boss-hp', 'star', 'fight',
])

export function isSyncMessage(value: unknown): value is SyncMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return (
    typeof message.type === 'string' &&
    MESSAGE_TYPES.has(message.type) &&
    (message.tab === 1 || message.tab === 2)
  )
}

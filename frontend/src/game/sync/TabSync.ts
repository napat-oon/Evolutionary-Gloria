import type {
  CastMessage,
  DamageMessage,
  MeleeMessage,
  PoseMessage,
  SyncMessage,
  TabId,
  WindupMessage,
} from './messages'
import { TAB_BOSS_COLOR } from './messages'
import type { SyncTransport } from './SyncTransport'

export interface TabSyncHandlers {
  onPose?: (message: PoseMessage) => void
  onCast?: (message: CastMessage) => void
  onMelee?: (message: MeleeMessage) => void
  onWindup?: (message: WindupMessage) => void
  onDamage?: (message: DamageMessage) => void
  onControlChange?: (hasControl: boolean) => void
}

/**
 * Session orchestrator for one tab. Exactly one tab controls the character
 * at a time (single writer for vitals); control follows window focus.
 */
export class TabSync {
  readonly tab: TabId
  handlers: TabSyncHandlers = {}

  private controlling: boolean
  private readonly transport: SyncTransport
  private readonly unsubscribe: () => void
  private readonly seenDamageIds = new Set<string>()
  private damageCounter = 0

  constructor(tab: TabId, transport: SyncTransport) {
    this.tab = tab
    this.transport = transport
    // Tab 1 starts in control; tab 2 takes over the moment it gains focus.
    this.controlling = tab === 1
    this.unsubscribe = transport.subscribe((message) => this.receive(message))
  }

  get hasControl(): boolean {
    return this.controlling
  }

  claimControl(): void {
    if (this.controlling) return
    this.controlling = true
    this.transport.post({ type: 'control', tab: this.tab })
    this.handlers.onControlChange?.(true)
  }

  publishPose(scene: string, x: number, y: number, facing: 1 | -1,
      vitals: PoseMessage['vitals']): void {
    this.transport.post({ type: 'pose', tab: this.tab, scene, x, y, facing, vitals })
  }

  publishCast(ability: CastMessage['ability'], aim: { x: number; y: number },
      moveDir: -1 | 0 | 1): void {
    this.transport.post({ type: 'cast', tab: this.tab, ability, aim, moveDir })
  }

  publishMelee(aim: { x: number; y: number }, comboStep: number): void {
    this.transport.post({ type: 'melee', tab: this.tab, aim, comboStep })
  }

  /** Announce that this tab's boss is winding up; the other tab shows the glow. */
  publishWindup(): void {
    this.transport.post({ type: 'windup', tab: this.tab, color: TAB_BOSS_COLOR[this.tab] })
  }

  /**
   * Damage seen on this tab. Applied locally by the caller only when this tab
   * has control; otherwise forwarded to the controlling tab (deduplicated).
   */
  reportDamage(amount: number): boolean {
    if (this.controlling) return true
    const eventId = `${this.tab}-${Date.now()}-${this.damageCounter++}`
    this.transport.post({ type: 'damage', tab: this.tab, amount, eventId })
    return false
  }

  dispose(): void {
    this.unsubscribe()
    this.transport.close()
  }

  private receive(message: SyncMessage): void {
    if (message.tab === this.tab) return
    switch (message.type) {
      case 'control':
        if (this.controlling) {
          this.controlling = false
          this.handlers.onControlChange?.(false)
        }
        break
      case 'pose':
        this.handlers.onPose?.(message)
        break
      case 'cast':
        this.handlers.onCast?.(message)
        break
      case 'melee':
        this.handlers.onMelee?.(message)
        break
      case 'windup':
        this.handlers.onWindup?.(message)
        break
      case 'damage':
        if (this.controlling && !this.seenDamageIds.has(message.eventId)) {
          this.seenDamageIds.add(message.eventId)
          if (this.seenDamageIds.size > 500) {
            this.seenDamageIds.clear()
          }
          this.handlers.onDamage?.(message)
        }
        break
    }
  }
}

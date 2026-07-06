import type {
  BossHpMessage,
  CastMessage,
  DamageMessage,
  EndedMessage,
  FightMessage,
  MeleeMessage,
  PoseMessage,
  SessionState,
  StarMessage,
  SyncMessage,
  TabId,
  WelcomeMessage,
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
  onBossHp?: (message: BossHpMessage) => void
  onStar?: (message: StarMessage) => void
  onFight?: (message: FightMessage) => void
  onWelcome?: (message: WelcomeMessage) => void
  onEnded?: (message: EndedMessage) => void
}

/**
 * Session orchestrator for one tab. Exactly one tab controls the character
 * at a time (single writer for vitals); control follows window focus.
 */
export class TabSync {
  readonly tab: TabId
  /** Unique per tab instance — tells duplicate same-dimension tabs apart. */
  readonly instanceId = Math.random().toString(36).slice(2)
  handlers: TabSyncHandlers = {}
  /** Set by the active scene; answers late-joining tabs' hello with state. */
  stateProvider?: () => SessionState

  private controlling: boolean
  private ended = false
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

  /** True once the session ended for everyone (someone left to the lobby). */
  get isEnded(): boolean {
    return this.ended
  }

  get hasControl(): boolean {
    return this.controlling
  }

  claimControl(): void {
    if (this.controlling || this.ended) return
    this.controlling = true
    this.transport.post({ type: 'control', tab: this.tab })
    this.handlers.onControlChange?.(true)
  }

  /** Ask any running session for its state (sent by a freshly opened tab). */
  publishHello(): void {
    this.transport.post({ type: 'hello', tab: this.tab, instanceId: this.instanceId })
  }

  /** Everyone's session is over: the player left for the lobby. */
  publishEnded(reason: EndedMessage['reason']): void {
    this.ended = true
    this.transport.post({
      type: 'ended', tab: this.tab, instanceId: this.instanceId, reason,
    })
  }

  publishPose(scene: string, x: number, y: number, facing: 1 | -1,
      vitals: PoseMessage['vitals']): void {
    this.transport.post({ type: 'pose', tab: this.tab, scene, x, y, facing, vitals })
  }

  publishCast(ability: CastMessage['ability'], aim: { x: number; y: number },
      aimPoint: { x: number; y: number }, moveDir: -1 | 0 | 1): void {
    this.transport.post({ type: 'cast', tab: this.tab, ability, aim, aimPoint, moveDir })
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
  reportDamage(amount: number, force = false): boolean {
    if (this.controlling) return true
    const eventId = `${this.tab}-${Date.now()}-${this.damageCounter++}`
    this.transport.post({ type: 'damage', tab: this.tab, amount, eventId, force })
    return false
  }

  publishBossHp(hp: number, maxHp: number): void {
    this.transport.post({ type: 'boss-hp', tab: this.tab, hp, maxHp })
  }

  publishStar(color: StarMessage['color']): void {
    const eventId = `${this.tab}-star-${Date.now()}-${this.damageCounter++}`
    this.transport.post({ type: 'star', tab: this.tab, color, eventId })
  }

  publishFight(phase: FightMessage['phase']): void {
    this.transport.post({ type: 'fight', tab: this.tab, phase })
  }

  dispose(): void {
    this.unsubscribe()
    this.transport.close()
  }

  private receive(message: SyncMessage): void {
    // Session-lifecycle messages are keyed by instance, not dimension, so
    // duplicate tabs of the same dimension can still handshake and stop.
    switch (message.type) {
      case 'hello':
        if (message.instanceId === this.instanceId) return
        // Any tab with a running scene answers — the joiner may have already
        // stolen control on focus, so "controlling" is not the criterion.
        if (!this.ended && this.stateProvider) {
          this.transport.post({
            type: 'welcome',
            tab: this.tab,
            instanceId: this.instanceId,
            targetInstanceId: message.instanceId,
            state: this.stateProvider(),
          })
        }
        return
      case 'welcome':
        // Control is not touched here: focus already decides who controls,
        // and the joiner is the tab the user just opened and focused.
        if (message.targetInstanceId !== this.instanceId) return
        this.handlers.onWelcome?.(message)
        return
      case 'ended':
        if (message.instanceId === this.instanceId || this.ended) return
        this.ended = true
        if (this.controlling) {
          this.controlling = false
          this.handlers.onControlChange?.(false)
        }
        this.handlers.onEnded?.(message)
        return
      default:
        break
    }

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
      case 'boss-hp':
        this.handlers.onBossHp?.(message)
        break
      case 'star':
        this.handlers.onStar?.(message)
        break
      case 'fight':
        this.handlers.onFight?.(message)
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

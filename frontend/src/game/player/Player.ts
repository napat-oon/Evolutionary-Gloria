import Phaser from 'phaser'
import { selectAbility } from '../core/intents'
import { TEX } from '../core/textures'
import { buildAttackRegistry } from './abilities'
import type { CastContext } from './AttackPattern'
import { Vitals } from './Vitals'

const RUN_SPEED = 230
const JUMP_SPEED = 460
const DASH_SPEED = 520
const DASH_MS = 240
const DASH_COOLDOWN_MS = 800
const COMBO_WINDOW_MS = 420
const COMBO_DAMAGE = [8, 8, 14]

export interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  up: Phaser.Input.Keyboard.Key
  down: Phaser.Input.Keyboard.Key
  jump: Phaser.Input.Keyboard.Key
  dash: Phaser.Input.Keyboard.Key
  /** V — the elemental-variant modifier (Ctrl clashes with browser shortcuts). */
  modifier: Phaser.Input.Keyboard.Key
  potion: Phaser.Input.Keyboard.Key
}

/**
 * Eevee: movement, dash/block, melee combo, elemental casts, heal bubble.
 * Attack behaviours live in AttackPattern implementations, not here.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly vitals: Vitals
  facing: 1 | -1 = 1

  /** Set by the sync layer so casts/melee replicate to the other tab. */
  onCastPerformed?: (ability: ReturnType<typeof selectAbility>, aim: { x: number; y: number }, moveDir: -1 | 0 | 1) => void
  onMeleePerformed?: (aim: { x: number; y: number }, comboStep: number) => void

  private readonly keys: PlayerKeys
  private readonly projectiles: Phaser.Physics.Arcade.Group
  private readonly attacks = buildAttackRegistry()
  private readonly bubble: Phaser.GameObjects.Image

  private lockedUntil = 0
  private dashCooldownUntil = 0
  private dashingUntil = 0
  private invulnerableUntil = 0
  private comboStep = 0
  private comboResetAt = 0
  private gravityDisabled = false
  private firePlunging = false
  private controlled = true

  constructor(scene: Phaser.Scene, x: number, y: number,
      projectiles: Phaser.Physics.Arcade.Group, potions: number) {
    super(scene, x, y, TEX.eevee)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.body!.setSize(24, 26)

    this.vitals = new Vitals(100, 100, potions, {
      onChange: (snapshot) => scene.registry.set('vitals', snapshot),
      onDeath: () => scene.events.emit('player:death'),
    })
    scene.registry.set('vitals', this.vitals.snapshot())

    this.projectiles = projectiles
    this.bubble = scene.add.image(x, y, TEX.bubble).setVisible(false).setDepth(5)

    const keyboard = scene.input.keyboard!
    this.keys = {
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      jump: keyboard.addKey('SPACE'),
      dash: keyboard.addKey('SHIFT'),
      modifier: keyboard.addKey('V'),
      potion: keyboard.addKey('R'),
    }

    scene.input.mouse?.disableContextMenu()
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.controlled) return
      if (pointer.rightButtonDown()) {
        this.tryCast()
      } else if (pointer.leftButtonDown()) {
        this.tryMeleeCombo()
      }
    })
  }

  get isDashing(): boolean {
    return this.scene.time.now < this.dashingUntil
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil || this.isDashing
  }

  /** Puppet mode: physics off, position driven by the other tab's poses. */
  setControlled(controlled: boolean): void {
    if (this.controlled === controlled) return
    this.controlled = controlled
    const body = this.body as Phaser.Physics.Arcade.Body
    body.moves = controlled
    if (controlled) {
      this.setVelocity(0, 0)
    }
  }

  get isControlled(): boolean {
    return this.controlled
  }

  applyRemotePose(x: number, y: number, facing: 1 | -1): void {
    this.setPosition(x, y)
    this.facing = facing
    this.setFlipX(facing === -1)
  }

  /** Replays a cast from the other tab; mana is owned by the controller. */
  castRemote(ability: ReturnType<typeof selectAbility>, aim: { x: number; y: number },
      moveDir: -1 | 0 | 1): void {
    const pattern = this.attacks.get(ability)
    if (!pattern) return
    pattern.cast({
      scene: this.scene,
      player: this,
      aim: new Phaser.Math.Vector2(aim.x, aim.y),
      moveDir,
      projectiles: this.projectiles,
    })
  }

  meleeRemote(aim: { x: number; y: number }, comboStep: number): void {
    this.spawnSlash(new Phaser.Math.Vector2(aim.x, aim.y), comboStep)
  }

  currentMoveDir(): -1 | 0 | 1 {
    if (this.keys.left.isDown && !this.keys.right.isDown) return -1
    if (this.keys.right.isDown && !this.keys.left.isDown) return 1
    return 0
  }

  lockFor(ms: number): void {
    this.lockedUntil = this.scene.time.now + ms
  }

  setInvulnerable(ms: number): void {
    this.invulnerableUntil = this.scene.time.now + ms
  }

  setGravityDisabled(disabled: boolean): void {
    this.gravityDisabled = disabled
    ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(!disabled)
  }

  /** Fire plunge: fast fall through passable floors until landing or any input. */
  beginFirePlunge(): void {
    this.firePlunging = true
    this.setVelocity(0, 820)
    this.lockFor(2000)
  }

  get passesThroughPlatforms(): boolean {
    return this.firePlunging
  }

  takeDamage(amount: number): void {
    if (this.isInvulnerable) return
    this.vitals.takeDamage(amount)
    this.setTint(0xffffff)
    this.setTintFill()
    this.scene.time.delayedCall(80, () => this.clearTint())
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    const deltaSeconds = delta / 1000
    this.vitals.update(deltaSeconds)

    // Heal bubble visual follows the vitals state.
    this.bubble.setVisible(this.vitals.healBubbleActive)
    this.bubble.setPosition(this.x, this.y)

    // Puppet tabs render only; the controlling tab owns input and physics.
    if (!this.controlled) return

    const body = this.body as Phaser.Physics.Arcade.Body

    // Any input interrupts the fire plunge but keeps downward momentum.
    if (this.firePlunging) {
      const interrupted =
        this.currentMoveDir() !== 0 || this.keys.jump.isDown || this.keys.dash.isDown
      if (interrupted || body.onFloor()) {
        this.firePlunging = false
        this.clearTint()
        this.lockedUntil = 0
      } else {
        return
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.potion)) {
      if (this.vitals.drinkPotion()) {
        this.scene.events.emit('player:potion', this.vitals.potions)
      }
    }

    if (time < this.lockedUntil || this.isDashing) return

    // Movement
    const moveDir = this.currentMoveDir()
    this.setVelocityX(moveDir * RUN_SPEED)
    if (moveDir !== 0) {
      this.facing = moveDir
      this.setFlipX(moveDir === -1)
    }
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.jump) || Phaser.Input.Keyboard.JustDown(this.keys.up)
    if (jumpPressed && body.onFloor() && !this.gravityDisabled) {
      this.setVelocityY(-JUMP_SPEED)
    }

    // Dash / dodge-block
    if (Phaser.Input.Keyboard.JustDown(this.keys.dash) && time >= this.dashCooldownUntil) {
      const dir = moveDir || this.facing
      this.dashingUntil = time + DASH_MS
      this.dashCooldownUntil = time + DASH_COOLDOWN_MS
      this.setVelocity(dir * DASH_SPEED, 0)
      this.setAlpha(0.55)
      this.scene.time.delayedCall(DASH_MS, () => this.setAlpha(1))
    }

    if (this.comboStep > 0 && time > this.comboResetAt) {
      this.comboStep = 0
    }
  }

  /** The direction the player is blocking toward while dashing (mouse angle). */
  blockAim(): Phaser.Math.Vector2 {
    return this.aimVector()
  }

  private aimVector(): Phaser.Math.Vector2 {
    const pointer = this.scene.input.activePointer
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2
    const aim = new Phaser.Math.Vector2(world.x - this.x, world.y - this.y)
    return aim.lengthSq() === 0 ? new Phaser.Math.Vector2(this.facing, 0) : aim.normalize()
  }

  private tryMeleeCombo(): void {
    const time = this.scene.time.now
    if (time < this.lockedUntil) return
    this.comboStep = time > this.comboResetAt ? 1 : Math.min(this.comboStep + 1, 3)
    this.comboResetAt = time + COMBO_WINDOW_MS
    this.lockFor(160)

    const aim = this.aimVector()
    this.spawnSlash(aim, this.comboStep)
    this.onMeleePerformed?.({ x: aim.x, y: aim.y }, this.comboStep)
  }

  private spawnSlash(aim: Phaser.Math.Vector2, comboStep: number): void {
    const damage = COMBO_DAMAGE[Math.min(comboStep, 3) - 1]
    const slash = this.projectiles.create(
      this.x + aim.x * 34, this.y + aim.y * 34, TEX.spark) as Phaser.Physics.Arcade.Image
    slash.setData('damage', damage)
    slash.setData('melee', true)
    slash.setScale(comboStep === 3 ? 2.6 : 1.8).setAlpha(0.85)
    slash.setRotation(aim.angle())
    ;(slash.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.scene.time.delayedCall(110, () => slash.destroy())
  }

  private tryCast(): void {
    const time = this.scene.time.now
    if (time < this.lockedUntil) return
    const moveDir = this.currentMoveDir()
    const ability = selectAbility({
      ctrl: this.keys.modifier.isDown,
      movingX: moveDir !== 0,
      up: this.keys.up.isDown,
      down: this.keys.down.isDown,
    })
    const pattern = this.attacks.get(ability)
    if (!pattern || !this.vitals.spendMana(pattern.manaCost)) return

    const aim = this.aimVector()
    const ctx: CastContext = {
      scene: this.scene,
      player: this,
      aim,
      moveDir,
      projectiles: this.projectiles,
    }
    pattern.cast(ctx)
    this.onCastPerformed?.(ability, { x: aim.x, y: aim.y }, moveDir)
  }

  destroy(fromScene?: boolean): void {
    this.bubble.destroy()
    super.destroy(fromScene)
  }
}

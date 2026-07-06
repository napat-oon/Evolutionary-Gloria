# Balance tuning guide

How to see every hitbox, where each gameplay number lives, and how to test
changes locally without deploying.

## Run the game locally

Two terminals:

```bash
# 1 — backend (H2 in-memory, no Docker needed)
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 2 — frontend dev server (hot-reloads on every save)
cd frontend && npm run dev
```

Open http://localhost:5173, register any throwaway account, and play.
Vite hot-reloads TypeScript edits — tweak a constant, save, and the game
refreshes in place (you'll be back at the intermission).

## Hitbox overlays

- Press **H** in-game to toggle (persists in localStorage, so both tabs pick
  it up on their next scene start), or open the game with `?hitboxes=1`
  (e.g. `http://localhost:5173/game?hitboxes=1`).
- Solid outlines = real physics bodies (Eevee, bosses, projectiles, melee
  slashes, platforms).
- **Pink** flashes = math-only hitboxes drawn at the moment they trigger:
  boss scythe melee box, Orion's dash-swipe oval (line = flat back edge),
  shell explosion radius, black-hole pull + grind circles, ultimate dive
  radius.
- **Red** box during the ultimate finale = the lethal zone (everything
  between the outer faces of the two cover walls).
- The implementation lives in `src/game/core/hitboxDebug.ts`; delete the
  `setupHitboxDebug`/`debugHitShape` calls when the temporary visuals are no
  longer wanted.

## Eevee — `src/game/player/Player.ts` (top-of-file constants)

| What | Constant |
|---|---|
| Run / jump / dash speeds & cooldown | `RUN_SPEED`, `JUMP_SPEED`, `DASH_SPEED`, `DASH_MS`, `DASH_COOLDOWN_MS` |
| Melee combo damage | `COMBO_DAMAGE` (= `[5, 5, 10]`) |
| Melee reach (from Eevee's center) & thickness | `MELEE_REACH` (42), `MELEE_THICKNESS` (30) |
| Combo window | `COMBO_WINDOW_MS` |
| Block arc radius / half-angle | `BLOCK_RADIUS`, `BLOCK_HALF_ANGLE` (40°) |

## Vitals — `src/game/player/Vitals.ts` (static fields)

`HEAL_PER_SECOND`, `MANA_PER_SECOND` (2), `POTION_HEAL`,
`POTION_COOLDOWN_SECONDS`, `ATTACK_MANA_RESTORE`.

## Abilities — `src/game/player/abilities.ts` (one class per ability)

| Ability | Tunables |
|---|---|
| StarShotgun | mana 20, 5 stars × 8 dmg, speed 520, spread 0.14 rad |
| WaterRush | mana 20, speed 560, 320 ms, shrink scale 0.2 |
| ElectricDive | mana 25, rise 240 ms + hover 510 ms (= 0.75 s delay), strike 18 dmg |
| FirePlunge | mana 25, fall speed 820 (in `Player.beginFirePlunge`), `PATH_DAMAGE` 20 |
| DarkSwing | mana 30, `DAMAGE = [24, 48, 96]`, `SCALE_X = [1.9, 2.6, 3.8]` — escalates on hit, state-3 hit wraps to 1, misses keep state |
| LeafBlade | mana 25, 22 dmg, dash speed 620, delay 650 ms |
| TwinRibbons | mana 25, 14 dmg each |
| IcicleStomp | mana 30, 5 × 16 dmg |

## Twins — `src/game/bosses/`

- `BossBase.ts`: scythe melee `MELEE_RANGE`/`MELEE_DAMAGE`, wave
  `WAVE_DAMAGE`, drift `MOVE_SPEED`, turn-start swoop `APPROACH_SPEED`
  / `APPROACH_STANDOFF` / `APPROACH_MS`, retreat `RETREAT_SPEED_X/Y`
  / `RETREAT_Y`, turn slots `TURN_MIN_MS`–`TURN_MAX_MS` (random 5–8 s,
  derived from the wall clock so both tabs agree without messages),
  special-pick chance (0.55 in `pickSpecial`).
- `Sirius.ts`: BoomerangScythe (16 dmg, 9 s cd), StarVolley (7 × 8 dmg,
  14 s cd), WardingCircle (×0.5 boss damage taken, 6.5 s, 18 s cd).
- `Orion.ts`: DashSwipe (20 dmg, `REACH_X` 230 / `REACH_Y` 90, 8 s cd),
  ExplosiveShell (22 dmg within 150 px), BlackHole (6 dmg per 500 ms grind,
  unblockable but dodgeable; pull 240 px, grind 46 px, 15 s cd).
- `UltimateSequence.ts`: `DIVE_DAMAGE` 14, `EXPLOSION_DAMAGE` 60,
  `FINALE_DELAY_MS` 2000, dive hit radius 75, finale safe margin ±18 px
  outside the walls.
- Boss HP pool: `BOSS_MAX_HP` in `src/game/scenes/BossRoomScene.ts`.

## Rooms — `src/game/scenes/`

- `BossRoomScene.ts`: arena size, wall positions, platform grid
  (`platformRows`), platform width (`setScale(1.5, 1)` — the base texture is
  96 px wide, so 1.5 ≈ 144 px).
- `IntermissionScene.ts`: dummy DPS window `DPS_WINDOW_MS`; the DPS divisor
  floors at 1 s.

## Notes

- Dark Swing's escalation state lives in the controlling tab; swapping tab
  focus mid-combo keeps a separate state per tab (they escalate
  independently). Its damage escalates only on hits that actually count
  (your own dimension — replayed swings on the other tab are visual).
- Turn randomness: both tabs compute the same 5–8 s schedule from
  `Date.now()`, so it stays message-free but only works for tabs on the same
  machine (which duo-tab play guarantees).

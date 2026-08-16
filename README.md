# Evolutionary Gloria
## ssc-y25t3-project-let-me-solo-you

_DISCLAIMER: Eevee is from Pokémon, and Sirius & Orion are from Warframe. You may view this as a fan project made for the game project that I intended to try. I am not the owner nor the creator of the assets, such as the background art, music, sound, and videos (aside from video edits)._

The final game project was made in under 2 weeks. (I was given 1 month, and a few more days for announcement/preparation in advance, but I was so intrigued at extending Zork game so the time decision was poor in this case).

The primary idea does not expect a fully completed product. Instead, it's evaluated by the effort I have put into the project over the past four weeks and what I have learned from using agentic coding tools or writing the code myself. 

(Git commit history is reviewed to assess my level of contribution and consistency. If the project appears to be something that could have been produced with just a few AI prompts, it will not be in a high performance case).

The project presentation focuses on:

- The design decisions I've made.
- The challenges I've encountered.
- The algorithms, techniques, or solutions I've used to solve problems.
- What I've learned throughout the development process.

The number of features the product has will not be of interest. Modern AI tools can generate features with minimal effort. What matters is the understanding of the problem, the engineering decisions, and the work effort I put into the project.

Finally, the project is deployed to a server using a CI/CD pipeline, with Automatic deployment.

---

Project details:

- Spring boot backend
- React frontend
- Vite or NextJs or other frameworks but not as backend
- CI/CD via github action
- Trivy, Semgrep scanned for CVEs
- Hibernate (ORM)
- PostgresSQL
- Spring Security
- Deploy to server with SSL and domain name (unfortunately, the server droplet is deactivated due to limited financial status)

---

### The Gimmick: One Player, Two Dimensions
- **One shared character**: whatever Player does in the focused tab is mirrored live into the other
- Twin bosses share a single HP pool — you must fight both dimensions at once
- **Strict duo rule**: the fight only runs while both tabs are open and alive
- _(This is the first and the worst design decision out of all my mistakes, that I highly need to address this)_
  - The Duo-tab gimmick came from me challenging myself, thinking I could replicate multiple different instances of the game interacting synchronously with each other (similar to an application game with multiple "dimensions" that require attention on both instances) for a deployed browser.
  - You may call it "Scope Creep" or "Poor Planning" because I was mainly blinded by "how could I make a game to look 'complex' enough (for the final project)?" and failed to realize, until halfway through the challenges encountered, that what I was doing were fighting the Browser Optimization or the browser's limitation with foreground & background tabs.
  - Since I was quite late to notice this design choice, with little time left, I had to try and do my best by circumventing said limitation.
  - If you ask me what I would do if I were not bound by time constraints, I would rather go back to step 1 in planning the game (not necessarily fully scrapping the whole game and assets) and revolve it around a normal one-tab browser game. (Mainly because I was planning the game as if it were an application, not as a browser game, which caused the "unforeseen" issues that regular browser developers would know first-hand).
  - Never have I thought how different a browser game would be from an application game, so this was a valuable, but also silly lesson about browser games. 

<details>
  <summary><b>Click to expand a rough sketch of the gimmick</b></summary>
<img width="1920" height="842" alt="image" src="https://github.com/user-attachments/assets/7199e48f-f099-4817-a06f-953a99494fc8" />
</details>

<details>
  <summary><b>Click to expand the main issue in trying to make a browser game with the chosen gimmick</b></summary>
<img width="1920" height="926" alt="image" src="https://github.com/user-attachments/assets/b9e06d9b-5fe6-47f8-8f57-379d350c7811" />
</details>

<details>
  <summary><b>Click to expand a few bugs/glitches/issues found during development</b></summary>
<img width="1920" height="929" alt="image" src="https://github.com/user-attachments/assets/3b636289-25f2-4962-b048-2bf6c514c908" />
</details>

---

<details>
  <summary><b>Click to expand "How to run the game locally and configure the variables" (TUNING.md)</b></summary>

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
  - **Red** boxes during the ultimate finale = the lethal zone: everything
    between the outer faces of the two cover walls, plus everything above
    the walls' top edge on the outer sides (cover only counts crouched
    behind a wall, below its top).
  - The implementation lives in `src/game/core/hitboxDebug.ts`; delete the
    `setupHitboxDebug`/`debugHitShape` calls when the temporary visuals are no
    longer wanted.
  
  ## Eevee — `src/game/player/Player.ts` (top-of-file constants)
  
  | What | Constant |
  |---|---|
  | Run / jump / dash speeds & cooldown | `RUN_SPEED`, `JUMP_SPEED`, `DASH_SPEED`, `DASH_MS`, `DASH_COOLDOWN_MS` |
  | Melee combo damage | `COMBO_DAMAGE` (= `[5, 5, 10]`) |
  | Melee reach (from Eevee's center) & thickness | `MELEE_REACH` (32), `MELEE_THICKNESS` (20) |
  | Combo window | `COMBO_WINDOW_MS` |
  | Block arc radius / half-angle | `BLOCK_RADIUS`, `BLOCK_HALF_ANGLE` (30°) |
  
  The slash is a single REACH×THICKNESS rectangle rotated to the mouse aim
  (0° horizontal … 90° vertical); arcade bodies can't rotate, so the physics
  body is that rotated rectangle's bounding box (see `Player.spawnSlash`).
  
  ## Vitals — `src/game/player/Vitals.ts` (static fields)
  
  `HEAL_PER_SECOND`, `MANA_PER_SECOND` (2), `POTION_HEAL`,
  `POTION_COOLDOWN_SECONDS`, `ATTACK_MANA_RESTORE`.
  
  ## Abilities — `src/game/player/abilities.ts` (one class per ability)
  
  | Ability | Tunables |
  |---|---|
  | StarShotgun | mana 20, 5 stars × 8 dmg, speed 520, spread 0.14 rad |
  | WaterRush | mana 20, speed 560, 320 ms, shrink scale 0.2 |
  | ElectricDive | mana 25, rise 240 ms + hover 510 ms (= 0.75 s delay), strike 36 dmg |
  | FirePlunge | mana 25, fall speed 820 (in `Player.beginFirePlunge`), `PATH_DAMAGE` 45 |
  | DarkSwing | mana 30, `DAMAGE = [48, 56, 96]`, `SCALE_X = [1.9, 2.6, 3.8]` — escalates on hit, state-3 hit wraps to 1, misses keep state |
  | LeafBlade | mana 25, 50 dmg, dash speed 620, delay 650 ms |
  | TwinRibbons | mana 25, 33 dmg each |
  | IcicleStomp | mana 25, 5 × 35 dmg |
  
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
    ExplosiveShell (22 dmg within 150 px, unblockable but dodgeable),
    BlackHole (6 dmg per 500 ms grind, unblockable but dodgeable; pull
    240 px, grind 46 px, 15 s cd).
  - `UltimateSequence.ts`: `DIVE_DAMAGE` 14, `EXPLOSION_DAMAGE` 40,
    `FINALE_DELAY_MS` 2000. Dives dash onto the `DIVE_STANDOFF` circle
    (100 px radially — any approach angle) around Eevee, freeze dead for
    `DIVE_PAUSE_MS` (100 ms — the hover drift is suspended while diving),
    then blast `DIVE_RADIUS` (300 px) from the twin's center.
    `DIVE_CYCLE_MS` (1040) must equal one full dive (dash 360 + pause 100 +
    rise 320 + settle 260) or the twins' turn-taking drifts between tabs.
    Finale safety = outside the walls ±18 px in X **and** below `wallTopY`.
  - Boss HP pool: `BOSS_MAX_HP` (5000) in `src/game/scenes/BossRoomScene.ts`.
  
  ## Cinematics — `src/game/scenes/BossCinematics.ts` + `BossRoomScene.ts`
  
  - Clips: `INTRO_VIDEOS` (one per dimension — Sirius and Orion can get
    different intro footage) and `ENDSCREEN_VIDEO`. Swap the URLs there if videos were to be changed; nothing else references
    the files. Loaded muted so autoplay always works. Intro plays its clip
    once, the victory endscreen once.
  - Timing is driven by the scene clock (clip duration + `CLOCK_SLACK_MS`),
    NOT by the video element: browsers defer muted playback in hidden tabs,
    but the worker heartbeat keeps stepping a hidden game, so both
    dimensions run their intros simultaneously and both bosses spawn even
    if a tab is never focused.
  - `BossRoomScene.ts`: `SPAWN_Y` (twin materialises at center, ~1 platform
    up), `ENDSCREEN_HOLD_MS` 5000 (last victory line → overlay),
    `VICTORY_STATS_TIMEOUT_MS` 8000 (server-stats wait cap).
  - `BossCinematics.ts`: `FLASH_MS` 400, `LINE_FADE_MS` 1000 (per victory
    line), `VIDEO_FAILSAFE_MS` 20000 (a broken video falls through instead
    of stalling the fight).
  
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
  
</details>

---

<details>
  <summary>Click to expand a list of videos for the game <b>Title/Login, Register, and Lobby screens</b></summary>
  
  https://github.com/user-attachments/assets/0a998f10-6eb7-4d30-9148-67ec1c1997ae

  https://github.com/user-attachments/assets/e3451d55-9437-4b7a-9a16-b646b8f47881
  
</details>

<details>
  <summary>Click to expand a list of showcase videos for the game's Player <b>movement and attacks</b></summary>

  https://github.com/user-attachments/assets/9941c429-4a9c-473e-992c-1ee6c6571333
  
  https://github.com/user-attachments/assets/fb70d299-1868-4164-a1bd-d286f666732e

  https://github.com/user-attachments/assets/788d1869-15fc-4135-b161-92e86902afb3

  https://github.com/user-attachments/assets/40818a34-106f-4f23-8748-383e332f8311

  https://github.com/user-attachments/assets/7f5ffed5-65ee-4ae8-9f70-094a71f0c86b

  https://github.com/user-attachments/assets/2a253b86-1d1b-4e6a-bec2-3137c221f2dc

</details>

<details>
  <summary>Click to expand a list of videos for the <b>in-game videos</b> <i>(these often fail to load in demo because the videos are 4K and I didn't force a loading screen)</i></summary>

  https://github.com/user-attachments/assets/e2e5c886-548b-4717-9798-0ae39d377bc8

  https://github.com/user-attachments/assets/efd8fd09-1794-47eb-8a06-7f16c4bed65b

  https://github.com/user-attachments/assets/e51a61ae-f9ff-4d2d-99bc-fd80153d0674

</details>

<details>
  <summary>Click to expand a video for buying and using <b>Potion</b></summary>

  https://github.com/user-attachments/assets/073aaf90-fbfb-483f-81f1-b6999927d33f

</details>

<details>
  <summary>Click to expand a list of videos for <b>countering</b> (including a fail example) <b>the Bosses' Ultimate</b> <i>(I'm informed by my tester friend that it is a little too hard or lacks guidance, which I agreed)</i></summary> 

  https://github.com/user-attachments/assets/096c8747-08dd-4990-8e2c-0eae95095c0a

  https://github.com/user-attachments/assets/a30af5e6-9d65-4f97-b470-182fab5580cd
  
  https://github.com/user-attachments/assets/7f704dfd-3725-4b71-9a77-259d34ed50b3

</details>

<details>
  <summary>Click to expand a video of the <b>leaderboard updating</b></summary>
  
  https://github.com/user-attachments/assets/9f3bd285-f325-4951-8077-d3a615fb248b

</details>

---

<img alt="tontaro eevee animated" src="https://static1.e926.net/data/e1/0e/e10e13b76ad749ab40e9f98dd620537b.gif" />

<img alt="tontaro sprigatito animated" src="https://static1.e926.net/data/f2/c8/f2c8e6af8eda2d81d22fefd7fa0cadfb.gif" />

(The images are made by tontaro. I am not the artist of the images, nor are we associated by any kinds. These images were put in as a funny gig/placeholder when the Git was created for the game project).

<img alt="kaminokefusa eevee" src="https://static1.e926.net/data/fe/46/fe464a66d662d4b3af5718dd2c87d6e0.jpg" />

<img alt="kaminokefusa sprigatito" src="https://static1.e926.net/data/e2/a7/e2a7dad97b9a760c39676695d5aae39d.jpg" />

(The images are made by kaminokefusa. I am not the artist of the images, nor are we associated by any kinds. These images were put in as a funny gig/placeholder when the Git was created for the game project).

Eevee and Evolutions by TAPI岡 (wolftapioca) (Main background image)
Eevee and Umbreon by otakuap (Leaderboard background image)

Sirius & Orion Images are created by Warframe, Digital Extremes, and edited for the assets by me.
Music: "Sacred Light" & "Celestial Clash" from Warframe, Digital Extremes.
Original Videos are edited from: "Warframe | Jade Shadows: Constellations Official Gameplay Trailer - Available Now On All Platforms!", "Warframe | SIRIUS/ORION: Jade Shadows: Constellations - Official Animated Short", and in-game footage.

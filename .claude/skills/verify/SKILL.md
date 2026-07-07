---
name: verify
description: Runtime-verify Evolutionary Gloria changes by driving the duo-tab game in headless Chrome (register, walk to the boss room, force fight outcomes, capture screenshots).
---

# Verify Evolutionary Gloria at runtime

## Launch (two background processes)

```bash
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev   # H2, no Docker; ready when /api/auth/me → 401
cd frontend && npm run dev                                          # http://localhost:5173 (source nvm first)
```

## Drive with Puppeteer

Chrome is cached in `~/.cache/puppeteer`; `npm i puppeteer` in a scratch dir.
Launch args: `--no-sandbox --autoplay-policy=no-user-gesture-required --mute-audio`,
`protocolTimeout: 180000`. **Listen to `page.on('pageerror')`** — a crashed
React tree renders an empty `#root` and every screenshot is a flat `#0b0d17`
rectangle, which looks like "game didn't load" but is really an exception.

- **Auth (bypasses the forms):** at the app origin, `fetch('/api/auth/register', …{username, email, password})` then `/api/auth/login` `{usernameOrEmail, password}` — httpOnly cookie lands, then `goto /game?tab=1`.
- **Duo tabs:** open `/game?tab=1` and `/game?tab=2` as two pages in one browser. The strict-duo overlay clears once both ping. `bringToFront()` before `page.keyboard.*` and before screenshots of a background page (they hang otherwise).
- **Reach the boss room:** hold `KeyD` ~8–10 s from spawn (door at x≈1840, run 230 px/s).
- **Timeline markers without touching game code:** watch `page.on('request')` for `/api/match/start` (intro finished, twin spawned) and `/api/match/complete` (fight ended); read the tab's own pose stream for scene changes via a `BroadcastChannel('gloria-tab-sync')` listener installed with `evaluateOnNewDocument`.
- **Force a fight outcome:** post synthetic sync messages from the page — the shared HP pool dies to `{type:'boss-hp', tab:2, hp:0, maxHp:600}` on tab 1 plus `{…, tab:1, …}` for tab 2 (messages are ignored when `tab` equals the receiver's own id).
- **Prove the hidden dimension is alive:** in headless, non-focused pages report `document.hidden === true` (a real repro of unfocused-tab throttling). Watch the wiretap for `{type:'windup', tab:2}` — the hidden tab's boss telegraphing is proof it spawned and fights without ever being focused (allow ~25 s: turn slots are 5–8 s).
- **Overlay checks:** `.result-modal` / `.shop-modal` in the DOM; `?hitboxes=1` shows hit shapes.
- **Zombie-input probe (lobby/after nav):** dispatch a cancelable synthetic `keydown` on `window`; `dispatchEvent` returning `false` means a leftover Phaser keyboard manager preventDefaulted it. Also count `document.querySelectorAll('canvas')`.

## Gotchas

- Phaser `Game.destroy()` only queues teardown for the next frame step — a sleeping loop (paused game) never runs it; `PhaserGame.tsx` forces `runDestroy()` on unmount for that case.
- The placeholder cinematic video is 0.9 s; intro ≈ 2 plays + ~1 s startup latency in headless.
- StrictMode double-mounts PhaserGame; anything touching the Game instance in cleanup must tolerate a not-yet-booted game (`isRunning` false).

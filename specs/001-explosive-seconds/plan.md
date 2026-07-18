# Implementation Plan: Explosive Seconds — Shared-Bomb Party Game

**Spec**: [spec.md](./spec.md)

## Technical Context

| Aspect | Choice | Why |
| --- | --- | --- |
| Language | Vanilla ES2020 modules (HTML/CSS/JS) | GitHub Pages serves static files; no build step means the repo *is* the deployable artifact. |
| Framework | None | The app is one state machine + one render function; a framework adds weight and a build pipeline for no benefit. |
| Realtime | [PeerJS](https://peerjs.com/) over WebRTC data channels, vendored in `vendor/` | GitHub Pages cannot host a WebSocket server. PeerJS's free public broker only handles signalling; game traffic is peer-to-peer. One host device = one room. |
| Persistence | `localStorage` | Settings, custom categories, and private per-room team-seat tokens; no server. |
| Tests | `node --test` on the pure logic module | Zero-dependency; runs in CI and locally. |
| Deploy | GitHub Actions → `actions/deploy-pages` | Official Pages flow; deploys repo root on every push to `main`. |

## Architecture

```
index.html            shell + screens (home/lobby/game/gameover)
css/styles.css        mobile-first, dark "party" theme
js/game.js            PURE rules engine (no DOM, no Date.now inside)
js/words.js           built-in categories & word lists
js/storage.js         settings, custom categories + private rejoin tokens
js/room.js            PeerJS wrapper: host(code) / join(code), broadcast
js/main.js            UI wiring, render loop, host loop, action routing
tests/game.test.mjs   unit tests for game.js
.github/workflows/deploy.yml   Pages deployment
```

### The rules engine (`game.js`)

A plain-object state machine mutated by exported functions, all of which take
`now` (epoch ms) as an argument — never reading the clock themselves — so the
whole game is unit-testable with fake time:

- `createGame(settings)` → lobby state
- `startGame(state, wordPool, now)` → shuffles the deck, phase `ready`
- `armBomb(state, now)` → sets `fuseDeadline = now + fuseMs`, deals a word,
  phase `playing`
- `markCorrect(state, now)` → score +1, bomb passes to next **alive** team,
  new word, skip counter resets (fuse untouched — the shared-bomb twist)
- `skipWord(state)` → new word for the same team, bounded by
  `skipsPerPossession`
- `explodeIfDue(state, now)` → if `now >= fuseDeadline`: holding team −1
  life, elimination check, phase `boom` (or `gameover` if one team remains)
- `continueAfterBoom(state)` → round +1, next alive team after the victim,
  phase `ready`

Guard rails: every action validates the current phase, and `markCorrect`/
`skipWord` first check the deadline — an action arriving after the bang is
ignored (the explosion wins the race). Words are never repeated: an empty
deck disables skipping, and dealing from a dry pool ends the game
(`endReason: 'exhausted'`, winner by lives → score → draw).

### Timing model

The fuse is an **absolute deadline**. Rendering asks "how many ms until
`fuseDeadline`?" on every animation frame, so a slow frame or a delayed
message can never add time. The host also runs a 100 ms interval calling
`explodeIfDue` — the explosion is decided by the host clock only.

### Networking model (one room)

- Host: `new Peer("xsec-" + CODE)` where CODE is 4 unambiguous letters.
  On any state change it broadcasts `{ t:"state", state, hostNow }` to every
  open connection (full snapshots — the state is tiny, so no delta protocol).
- Client: connects to `xsec-` + code, renders every snapshot it receives, and
  computes `clockOffset = hostNow - Date.now()` so its fuse display matches
  the host's clock. Inputs are sent as `{ t:"action", a:"correct"|"skip"|"arm" }`
  and applied (or rejected) by the host.
- Any device may act — this is a living-room game; the phone being handed
  around might be a guest's. Authority, not permission, prevents conflicts.
- In two-device mode, each client opens with a `hello` carrying its private
  per-room token. The first token seen owns team 2 for the lifetime of the
  room. A newer connection with that same token replaces the old connection;
  all other tokens receive the spectator role.
- The joining browser stores its token locally and automatically
  reconnects when `?room=CODE` is reloaded. Tokens are handshake-only and are
  not part of game snapshots. When team 2 is offline, its seat stays reserved
  while the Host can operate both teams, so the game does not stall.
- Failure handling: broker unreachable / code taken / bad code each surface a
  readable message; the local game is never blocked by the room.

### Render model

One `render(state)` function keyed on `state.phase` drives screen visibility
and content; a `requestAnimationFrame` loop repaints only the fuse (digits +
bar). Clients call the same `render` with the last received snapshot, with
edit controls hidden.

## Decisions & Trade-offs

1. **Shared fuse, not per-team clocks** — per the product brief, the one
   minute is shared: passing the bomb never pauses it. This is the game's
   core tension and is enforced in the engine (nothing but `armBomb` writes
   `fuseDeadline`).
2. **Full-snapshot sync** — state is < 2 KB; snapshots are idempotent and
   self-healing after packet loss, unlike deltas.
3. **PeerJS public broker** — free and serverless for us; the trade-off is
   occasional broker downtime, mitigated because local play never needs it.
4. **No framework/build** — the deploy artifact equals the source tree,
   which keeps GitHub Pages deployment trivial and reviewable.
5. **Reserved team seat on disconnect** — promoting an arbitrary spectator
   would let another browser steal team 2 after a brief network drop. The Host
   instead retains the original token and temporarily controls both teams;
   only the owning browser can reclaim the remote seat.

## Verification

- `node --test tests/*.test.mjs` — engine rules (passing, skipping, explosion,
  elimination, victory, deck reshuffle, late-action rejection) and local
  rejoin-token persistence.
- Manual: `python3 -m http.server` → play a full local game; host + join a
  room from two browser tabs.

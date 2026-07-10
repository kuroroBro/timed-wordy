# Tasks: Explosive Seconds — Shared-Bomb Party Game

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1 — Rules engine (US-2)
- [x] T001 `js/game.js`: state factory, phases, deck shuffle/deal
- [x] T002 `js/game.js`: `armBomb`, `markCorrect` (bomb passes, fuse untouched), `skipWord` with per-possession limit
- [x] T003 `js/game.js`: `explodeIfDue` (life loss, elimination, winner), `continueAfterBoom` (next round starts after the victim)
- [x] T004 `tests/game.test.mjs`: unit tests incl. late-action-after-bang rejection and deck reshuffle

## Phase 2 — Content & persistence (US-1, US-3)
- [x] T005 `js/words.js`: 8 built-in categories (50 words each)
- [x] T006 `js/storage.js`: settings + custom categories in localStorage

## Phase 3 — UI (US-1, US-2, US-3)
- [x] T007 `index.html` + `css/styles.css`: home, lobby, game, boom, gameover screens; mobile-first dark theme
- [x] T008 `js/main.js`: lobby editors (teams, members, categories, custom category dialog, sliders)
- [x] T009 `js/main.js`: game loop — rAF fuse painter, 100 ms host explosion check, urgency styling under 10 s

## Phase 4 — One room (US-4)
- [x] T010 `js/room.js`: host room with 4-letter code, join by code, broadcast/send, error surfacing
- [x] T011 `js/main.js`: host-authoritative action routing, snapshot broadcast on every change, client clock-offset fuse rendering

## Phase 4b — Two-device hand-over (US-5)
- [x] T014 `js/room.js`: per-connection team roles (first joiner = team 2, auto re-assigned on disconnect), role messages to clients
- [x] T015 `js/main.js` + `index.html`: "Two devices" toggle in setup, host-side action permission (`deviceMayAct`), locked "get ready" view on the waiting device, "You: team" pill

## Phase 5 — Deploy
- [x] T012 `.github/workflows/deploy.yml`: GitHub Pages deployment from repo root on push to `main`; `.nojekyll`
- [x] T013 `README.md`: rules, room mode, local dev, enabling Pages

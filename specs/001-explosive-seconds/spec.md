# Feature Specification: Explosive Seconds — Shared-Bomb Party Game

**Feature branch**: `001-explosive-seconds`
**Status**: Implemented
**Created**: 2026-07-10

## Overview

A free, ad-free, charades-style "hot potato" party game that runs entirely in
the browser and is hosted on GitHub Pages. The app handles the words, the
timer, and the scorekeeping. Unlike the original *Explosive Seconds* (where
each team has its own clock), this variant uses **one shared bomb timer**:
a single 60-second fuse is passed between teams. Guess your word to shove the
bomb to the next team; whoever is holding it when it explodes loses a life.

Multiple devices can connect to **one room** so everyone in the living room
sees the same bomb, the same word prompts, and the same scores in real time.

## User Stories

### US-1: Set up a game night (host)
As a party host, I want to create teams, pick word categories, and tweak the
fuse length and lives, so the game fits my group.

**Acceptance criteria**
- Can add 2–8 teams, rename them, and remove them.
- Can set the number of members per team (display-only metadata used to
  suggest who's up; the app never blocks play on it).
- Can select one or more word categories; at least one must be selected to
  start.
- Can set fuse length (30–180 s, default 60 s), lives per team (1–9,
  default 3), and skips per possession (unlimited, or 1–5).
- Settings persist across page reloads (localStorage).

### US-2: Play the shared-bomb round
As a player, I want the app to run the bomb, the words, and the lives, so we
just play.

**Acceptance criteria**
- A round starts with a "Team X is holding the bomb — arm it!" hand-off
  screen; the fuse only starts when the holding team taps **Arm**.
- One shared fuse counts down for the whole round; it does **not** reset or
  pause when the bomb changes hands.
- Tapping **Got it!** marks the word correct (+1 to the team's score), passes
  the bomb to the next surviving team, and deals that team a new word.
- Tapping **Skip** deals a new word to the same team, limited by the
  skips-per-possession setting.
- When the fuse hits zero, the game shows an explosion: the holding team
  loses one life; everyone sees who blew up.
- A team at 0 lives is eliminated. The last surviving team wins.
- After an explosion (with 2+ teams still alive) the next round begins with a
  fresh fuse, starting from the team after the one that exploded.
- Words never repeat within a game until the selected pool is exhausted, at
  which point the deck reshuffles.

### US-3: Custom categories
As a host, I want to create my own word categories (inside jokes, family
names, course topics), so the game fits my crowd.

**Acceptance criteria**
- Can create a named category from a free-text word list (comma or newline
  separated, minimum 5 words).
- Custom categories appear alongside built-in ones and can be selected,
  deselected, and deleted.
- Custom categories persist in localStorage.

### US-4: One shared room (multi-device)
As a group, we want every phone to connect to a single room so the current
word is visible to the describing player while the bomb and scores are
visible to everyone.

**Acceptance criteria**
- Host can open a room and gets a short, human-friendly room code.
- Any device can join by entering the code; no accounts, no server owned by
  us (peer-to-peer WebRTC via the public PeerJS broker).
- All devices render the same game state: phase, word, fuse, scores, lives.
- Any connected device can press **Arm** / **Got it!** / **Skip** — the host
  device is authoritative and validates every action (late actions after the
  bang are ignored).
- If the room can't be created or joined, the app says so and local
  pass-the-phone play still works (the room is optional, never required).

## Functional Requirements

- **FR-1** Static site only: must run from GitHub Pages (no backend, no build
  step required to serve).
- **FR-2** Game logic must be a pure, testable module (no DOM, no wall-clock
  reads inside the rules; timestamps are passed in).
- **FR-3** Fuse timing uses an absolute deadline (epoch ms), not decrementing
  counters, so rendering lag can't stretch the fuse.
- **FR-4** Host-authoritative networking: only the host mutates state;
  clients send intents and render broadcast snapshots. Snapshots carry the
  host's clock so clients can offset-correct the fuse display.
- **FR-5** Works offline / single-device (pass the phone) with zero network
  calls besides loading the page.
- **FR-6** Mobile-first UI with large tap targets; the fuse must be readable
  from across a room (huge digits + shrinking bar + urgency color under 10 s).
- **FR-7** No ads, no analytics, no tracking.

## Non-goals

- Persistent accounts, matchmaking, or cross-room discovery.
- Enforcing turn order of individual players within a team.
- Guaranteeing WebRTC connectivity on locked-down networks (fallback is
  pass-the-phone mode).

## Key Entities

- **Settings**: fuse seconds, lives, skips per possession, selected category
  ids, team definitions (name, members).
- **Team**: id, name, members, lives, score (correct guesses), alive flag.
- **Game**: phase (`lobby → ready → playing → boom → gameover`), teams,
  active team index, fuse deadline, current word, deck, round number,
  winner, last exploded team.
- **Category**: id, name, emoji, word list; built-in or custom (custom stored
  locally).
- **Room**: 4-letter code, host peer, client connections.

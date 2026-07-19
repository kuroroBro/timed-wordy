# 💣 Explosive Seconds — Team-Clock Party Game

A free, ad-free, charades-style party game that runs entirely in your browser
and deploys to GitHub Pages. The app handles the words, the bomb timer, and
the scorekeeping — you just play.

Each team has **its own clock**. Guess your word to pass the bomb to the other
team: your clock pauses and theirs starts. Whoever runs out of their own time
loses a life. Last team alive wins.

## How to play

1. **Set up** — name your 2 teams (head to head) and set member counts, pick word categories
   (or create your own custom lists), and tune the rules: time per team
   (default 60 s), lives per team (default 3), and skips per turn.
2. **Hand-off** — the holding team taps **🔥 Arm the bomb** and their clock
   starts burning.
3. **Describe & guess** — one player describes the word, teammates guess.
   - **✓ Got it!** → point scored, your clock pauses, and the other team's
     clock starts with a fresh word.
   - **↻ Skip** → new word, same team (limited by your skip setting).
4. **💥 BOOM** — when the fuse hits zero the holding team loses a life.
   A team at zero lives is eliminated; the next round starts with fresh team
   clocks. The last surviving team wins!

On a keyboard, ← **Skip** / → **Got it!** / ↑ **Arm the bomb** work alongside
the on-screen buttons — handy for a laptop passed around the table. Rebind
any of the three (or reset to defaults) from the **Keyboard shortcuts** panel
in game setup; the choice is saved per browser. The listener stays out of the
way of text fields (team names, join code, custom word lists) and only fires
while the matching action is actually available.

## One room, many phones (optional)

Everyone can watch the same game from their own device:

1. The host taps **📡 Open a room** in game setup and gets a 4-letter code.
2. Everyone else opens the same page and taps **Join room** with the code.
3. All devices show the same word, fuse, and scores in real time, and any
   device can press Arm / Got it! / Skip.

**Two devices, one bomb:** with a room open, tick **"Two devices"** in game
setup to give each team its own phone. The host's device is team 1 and the
first browser to join claims team 2 with a private per-room token. Reloading
the room URL automatically reclaims that team seat; other devices remain
spectators and cannot take it while its owner is offline. Only the device
holding the bomb sees the word and the buttons — after every correct guess
the bomb hands over to the other device, while each team's clock is tracked
separately. The waiting device sees a "get ready" screen (fuse and scores,
no word).

Rooms use peer-to-peer WebRTC (via the public [PeerJS](https://peerjs.com)
broker) — there is no game server. Preferences, custom lists, and the private
team-seat rejoin token are stored only in that browser's localStorage. If the
room service is unreachable, pass-the-phone play on a single device always
works.

If you'd rather use your own [peerjs-server](https://github.com/peers/peerjs-server)
(e.g. the public broker is down, or you're on a LAN), point every device at it
with a URL parameter: `?broker=host:port`.

## Deploying to GitHub Pages

The site is fully static — no build step.

1. In the repository, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**.
2. Push to `main`. The [deploy workflow](.github/workflows/deploy.yml) runs
   the engine tests and publishes the site to
   `https://<user>.github.io/<repo>/`.

## Local development

```bash
python3 -m http.server 8000   # any static server works
# open http://localhost:8000
node --test tests/*.test.mjs      # rules and storage unit tests
```

## Design docs (SDD)

This project was built spec-first. See
[`specs/001-explosive-seconds/`](specs/001-explosive-seconds/):
[spec.md](specs/001-explosive-seconds/spec.md) (what & why) →
[plan.md](specs/001-explosive-seconds/plan.md) (architecture & decisions) →
[tasks.md](specs/001-explosive-seconds/tasks.md) (work breakdown).

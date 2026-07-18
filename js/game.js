// Pure rules engine for Explosive Seconds (separate team clocks).
// No DOM, no Date.now() — every time-dependent function takes `now` (epoch ms).

export const PHASE = {
  LOBBY: 'lobby',
  READY: 'ready',       // team holds the unlit bomb, waiting to arm
  PLAYING: 'playing',   // fuse burning
  BOOM: 'boom',         // explosion overlay
  GAMEOVER: 'gameover',
};

export const UNLIMITED_SKIPS = -1;

export function createGame(settings) {
  return {
    phase: PHASE.LOBBY,
    settings: {
      fuseSeconds: settings.fuseSeconds ?? 60,
      lives: settings.lives ?? 3,
      skipsPerPossession: settings.skipsPerPossession ?? UNLIMITED_SKIPS,
      // Device-permission flag carried in state so every device renders the
      // same rule; the engine itself doesn't act on it.
      twoDevices: settings.twoDevices ?? false,
    },
    teams: settings.teams.map((t, i) => ({
      id: i,
      name: t.name,
      members: t.members ?? 2,
      lives: settings.lives ?? 3,
      score: 0,
      alive: true,
      timeRemainingMs: (settings.fuseSeconds ?? 60) * 1000,
    })),
    activeTeam: 0,
    round: 0,
    fuseDeadline: null,
    word: null,
    deck: [],
    wordsLeft: 0,
    skipsUsed: 0,
    winner: null,
    endReason: null,
    lastBoomTeam: null,
  };
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Words are never repeated within a game. Returns false when the pool is dry.
function dealWord(state) {
  if (state.deck.length === 0) return false;
  state.word = state.deck.pop();
  state.wordsLeft = state.deck.length;
  return true;
}

// The pool ran dry mid-game: every word was guessed or skipped. End the game —
// most lives wins, score breaks ties, a full tie is a draw.
function endByExhaustion(state) {
  const survivors = aliveTeams(state)
    .slice()
    .sort((a, b) => (b.lives - a.lives) || (b.score - a.score));
  const [first, second] = survivors;
  state.winner =
    second && first.lives === second.lives && first.score === second.score
      ? null // draw
      : first.id;
  state.word = null;
  state.fuseDeadline = null;
  state.endReason = 'exhausted';
  state.phase = PHASE.GAMEOVER;
}

function aliveTeams(state) {
  return state.teams.filter((t) => t.alive);
}

function nextAliveIndex(state, from) {
  const n = state.teams.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (state.teams[i].alive) return i;
  }
  return from;
}

export function startGame(state, wordPool, rng = Math.random) {
  if (state.phase !== PHASE.LOBBY) return false;
  if (state.teams.length < 2 || wordPool.length === 0) return false;
  state.deck = shuffle(wordPool, rng);
  state.wordsLeft = state.deck.length;
  state.round = 1;
  state.activeTeam = 0;
  state.phase = PHASE.READY;
  return true;
}

export function armBomb(state, now) {
  if (state.phase !== PHASE.READY) return false;
  if (!dealWord(state)) {
    endByExhaustion(state);
    return true;
  }
  state.fuseDeadline = now + state.teams[state.activeTeam].timeRemainingMs;
  state.skipsUsed = 0;
  state.phase = PHASE.PLAYING;
  return true;
}

// Returns true if the bomb went off (the explosion wins any race with input).
export function explodeIfDue(state, now) {
  if (state.phase !== PHASE.PLAYING || now < state.fuseDeadline) return false;
  const victim = state.teams[state.activeTeam];
  victim.timeRemainingMs = 0;
  victim.lives -= 1;
  if (victim.lives <= 0) victim.alive = false;
  state.lastBoomTeam = state.activeTeam;
  state.word = null;
  state.fuseDeadline = null;
  const survivors = aliveTeams(state);
  if (survivors.length <= 1) {
    state.phase = PHASE.GAMEOVER;
    state.winner = survivors[0]?.id ?? null;
    state.endReason = 'elimination';
  } else {
    state.phase = PHASE.BOOM;
  }
  return true;
}

export function markCorrect(state, now) {
  if (state.phase !== PHASE.PLAYING) return false;
  if (explodeIfDue(state, now)) return false; // too late — it already blew up
  const current = state.teams[state.activeTeam];
  current.timeRemainingMs = Math.max(0, state.fuseDeadline - now);
  current.score += 1;
  state.activeTeam = nextAliveIndex(state, state.activeTeam);
  state.fuseDeadline = now + state.teams[state.activeTeam].timeRemainingMs;
  state.skipsUsed = 0;
  // The next team's saved clock starts immediately — unless the pool is dry.
  if (!dealWord(state)) endByExhaustion(state);
  return true;
}

export function skipWord(state, now) {
  if (state.phase !== PHASE.PLAYING) return false;
  if (explodeIfDue(state, now)) return false;
  const max = state.settings.skipsPerPossession;
  if (max !== UNLIMITED_SKIPS && state.skipsUsed >= max) return false;
  if (state.deck.length === 0) return false; // nothing left to swap in
  state.skipsUsed += 1;
  dealWord(state);
  return true;
}

export function continueAfterBoom(state) {
  if (state.phase !== PHASE.BOOM) return false;
  state.round += 1;
  state.activeTeam = nextAliveIndex(state, state.lastBoomTeam);
  const fullTimeMs = state.settings.fuseSeconds * 1000;
  for (const team of state.teams) {
    if (team.alive) team.timeRemainingMs = fullTimeMs;
  }
  state.phase = PHASE.READY;
  return true;
}

export function skipsLeft(state) {
  const max = state.settings.skipsPerPossession;
  if (max === UNLIMITED_SKIPS) return Infinity;
  return Math.max(0, max - state.skipsUsed);
}

export function fuseRemainingMs(state, now, teamIndex = state.activeTeam) {
  const team = state.teams[teamIndex];
  if (!team) return 0;
  if (state.phase === PHASE.PLAYING && teamIndex === state.activeTeam && state.fuseDeadline != null) {
    return Math.max(0, state.fuseDeadline - now);
  }
  return team.timeRemainingMs;
}

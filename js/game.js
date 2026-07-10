// Pure rules engine for Explosive Seconds (shared-bomb variant).
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
    },
    teams: settings.teams.map((t, i) => ({
      id: i,
      name: t.name,
      members: t.members ?? 2,
      lives: settings.lives ?? 3,
      score: 0,
      alive: true,
    })),
    activeTeam: 0,
    round: 0,
    fuseDeadline: null,
    word: null,
    deck: [],
    usedWords: [],
    skipsUsed: 0,
    winner: null,
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

function dealWord(state, rng) {
  if (state.deck.length === 0) {
    // Pool exhausted: reshuffle everything we've seen back into the deck.
    state.deck = shuffle(state.usedWords, rng);
    state.usedWords = [];
    if (state.deck.length === 0) return; // pathological empty pool
  }
  state.word = state.deck.pop();
  state.usedWords.push(state.word);
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
  state.usedWords = [];
  state.round = 1;
  state.activeTeam = 0;
  state.phase = PHASE.READY;
  return true;
}

export function armBomb(state, now, rng = Math.random) {
  if (state.phase !== PHASE.READY) return false;
  state.fuseDeadline = now + state.settings.fuseSeconds * 1000;
  state.skipsUsed = 0;
  dealWord(state, rng);
  state.phase = PHASE.PLAYING;
  return true;
}

// Returns true if the bomb went off (the explosion wins any race with input).
export function explodeIfDue(state, now) {
  if (state.phase !== PHASE.PLAYING || now < state.fuseDeadline) return false;
  const victim = state.teams[state.activeTeam];
  victim.lives -= 1;
  if (victim.lives <= 0) victim.alive = false;
  state.lastBoomTeam = state.activeTeam;
  state.word = null;
  state.fuseDeadline = null;
  const survivors = aliveTeams(state);
  if (survivors.length <= 1) {
    state.phase = PHASE.GAMEOVER;
    state.winner = survivors[0]?.id ?? null;
  } else {
    state.phase = PHASE.BOOM;
  }
  return true;
}

export function markCorrect(state, now, rng = Math.random) {
  if (state.phase !== PHASE.PLAYING) return false;
  if (explodeIfDue(state, now)) return false; // too late — it already blew up
  state.teams[state.activeTeam].score += 1;
  state.activeTeam = nextAliveIndex(state, state.activeTeam);
  state.skipsUsed = 0;
  dealWord(state, rng); // fuse untouched: the shared bomb keeps burning
  return true;
}

export function skipWord(state, now, rng = Math.random) {
  if (state.phase !== PHASE.PLAYING) return false;
  if (explodeIfDue(state, now)) return false;
  const max = state.settings.skipsPerPossession;
  if (max !== UNLIMITED_SKIPS && state.skipsUsed >= max) return false;
  state.skipsUsed += 1;
  dealWord(state, rng);
  return true;
}

export function continueAfterBoom(state) {
  if (state.phase !== PHASE.BOOM) return false;
  state.round += 1;
  state.activeTeam = nextAliveIndex(state, state.lastBoomTeam);
  state.phase = PHASE.READY;
  return true;
}

export function skipsLeft(state) {
  const max = state.settings.skipsPerPossession;
  if (max === UNLIMITED_SKIPS) return Infinity;
  return Math.max(0, max - state.skipsUsed);
}

export function fuseRemainingMs(state, now) {
  if (state.phase === PHASE.READY) return state.settings.fuseSeconds * 1000;
  if (state.phase !== PHASE.PLAYING || state.fuseDeadline == null) return 0;
  return Math.max(0, state.fuseDeadline - now);
}

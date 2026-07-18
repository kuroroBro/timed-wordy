// UI wiring, render loop, and host-authoritative action routing.

import {
  PHASE, UNLIMITED_SKIPS,
  createGame, startGame, armBomb, markCorrect, skipWord,
  explodeIfDue, continueAfterBoom, skipsLeft, fuseRemainingMs,
} from './game.js';
import { BUILTIN_CATEGORIES, buildWordPool } from './words.js';
import {
  loadSettings, saveSettings,
  loadCustomCategories, saveCustomCategories,
  filterUnusedWords, markWordUsed, parseWordList, makeCustomCategory, resetUsedWords,
} from './storage.js';
import { hostRoom, joinRoom, normalizeCode } from './room.js';

const $ = (id) => document.getElementById(id);

// ---------- app state ----------
let mode = 'local';            // 'local' | 'host' | 'client'
let game = null;               // authoritative state (local/host) or last snapshot (client)
let settings = loadSettings();
let customCategories = loadCustomCategories();
let room = null;               // host room handle
let client = null;             // client connection handle
let clientTeam = null;         // client: my team index in two-device mode (null = spectator)
let peerCount = 0;             // host: connected devices
let clockOffset = 0;           // client: hostClock - localClock
let boomTimer = null;

const BOOM_DISPLAY_MS = 3200;
const RESET_USED_WORDS_MESSAGE = 'All words in the selected categories have been used. Reset word data so words can be reused?';

function syncedNow() {
  return Date.now() + clockOffset;
}

// ---------- screens ----------
const SCREENS = ['screen-home', 'screen-lobby', 'screen-game', 'screen-gameover'];
function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

// =====================================================================
// Authoritative game flow (local & host modes)
// =====================================================================

function isAuthority() {
  return mode !== 'client';
}

// In two-device mode only the device holding the bomb may act. The host
// device is team 0; if the second device leaves, the host runs both teams.
function deviceMayAct(state, actorTeam) {
  if (!state.settings?.twoDevices) return true;
  if (actorTeam == null) return false; // spectator device
  if (actorTeam === 0 && peerCount === 0) return true;
  return actorTeam === state.activeTeam;
}

function applyAction(action, actorTeam = 0) {
  if (!isAuthority() || !game) return;
  if (!deviceMayAct(game, actorTeam)) return;
  const t = Date.now();
  let changed = false;
  if (action === 'arm') changed = armBomb(game, t);
  else if (action === 'correct') changed = markCorrect(game, t) || game.phase !== PHASE.PLAYING;
  else if (action === 'skip') changed = skipWord(game, t) || game.phase !== PHASE.PLAYING;
  if (changed) afterChange();
}

function afterChange() {
  if (isAuthority() && game?.phase === PHASE.PLAYING && game.word) markWordUsed(game.word);
  if (game && game.phase === PHASE.BOOM && boomTimer == null) {
    boomTimer = setTimeout(() => {
      boomTimer = null;
      if (game && continueAfterBoom(game)) afterChange();
    }, BOOM_DISPLAY_MS);
  }
  broadcast();
  render();
}

function broadcast() {
  if (!room) return;
  const state = game
    ? { ...game, deck: undefined } // don't leak upcoming words (wordsLeft carries the count)
    : { phase: PHASE.LOBBY, teams: settings.teams, settings: { twoDevices: settings.twoDevices } };
  room.broadcast({ t: 'state', state, hostNow: Date.now() });
}

// Host clock decides the explosion, checked often enough to feel instant.
setInterval(() => {
  if (isAuthority() && game && game.phase === PHASE.PLAYING) {
    if (explodeIfDue(game, Date.now())) afterChange();
  }
}, 100);

function beginGame() {
  const errEl = $('lobby-error');
  errEl.hidden = true;
  const twoDevices = settings.twoDevices && !!room; // meaningless without a room
  if (twoDevices && peerCount === 0) {
    errEl.textContent = 'Two-device mode needs the other team’s device in the room first.';
    errEl.hidden = false;
    return;
  }
  const fullPool = buildWordPool(settings.categoryIds, customCategories);
  let pool = filterUnusedWords(fullPool);
  if (pool.length === 0 && fullPool.length > 0) {
    if (!window.confirm(RESET_USED_WORDS_MESSAGE)) return;
    resetUsedWords();
    pool = fullPool;
  }
  const candidate = createGame({
    fuseSeconds: settings.fuseSeconds,
    lives: settings.lives,
    skipsPerPossession: settings.skipsPerPossession,
    twoDevices,
    teams: settings.teams,
  });
  if (!startGame(candidate, pool)) {
    errEl.textContent =
      settings.teams.length < 2
        ? 'You need at least 2 teams.'
        : 'Pick at least one category with words in it.';
    errEl.hidden = false;
    return;
  }
  game = candidate;
  afterChange();
}

function backToLobby() {
  if (boomTimer) { clearTimeout(boomTimer); boomTimer = null; }
  game = null;
  broadcast();
  renderLobby();
  showScreen('screen-lobby');
}

// =====================================================================
// Rendering
// =====================================================================

function render() {
  if (!game) return;
  const phase = game.phase;

  if (phase === PHASE.LOBBY) {
    // Only clients ever render a lobby snapshot (host edits the real lobby UI).
    if (mode === 'client') {
      showScreen('screen-game');
      $('game-waiting').hidden = false;
      $('game-ready').hidden = true;
      $('game-playing').hidden = true;
      $('game-locked').hidden = true;
      $('screen-boom').hidden = true;
      const myTeam = clientTeam != null ? game.teams?.[clientTeam] : null;
      $('active-team-banner').textContent =
        game.settings?.twoDevices && myTeam
          ? `Connected 🎉 — this device is ${myTeam.name}`
          : 'Connected to the room 🎉';
      $('team-status').innerHTML = '';
    }
    return;
  }

  if (phase === PHASE.GAMEOVER) {
    $('screen-boom').hidden = true;
    renderGameover();
    showScreen('screen-gameover');
    return;
  }

  showScreen('screen-game');
  const myTeamIndex = mode === 'client' ? clientTeam : 0;
  const holdsBomb = deviceMayAct(game, myTeamIndex);
  const lockedHere = (phase === PHASE.READY || phase === PHASE.PLAYING) && !holdsBomb;
  $('game-waiting').hidden = true;
  $('game-ready').hidden = phase !== PHASE.READY || !holdsBomb;
  $('game-playing').hidden = phase !== PHASE.PLAYING || !holdsBomb;
  $('game-locked').hidden = !lockedHere;
  $('screen-boom').hidden = phase !== PHASE.BOOM;

  $('game-round').textContent = `Round ${game.round}`;
  const teamPill = $('game-team');
  if (game.settings.twoDevices && myTeamIndex != null && game.teams[myTeamIndex]) {
    teamPill.hidden = false;
    teamPill.textContent = `You: ${game.teams[myTeamIndex].name}`;
  } else {
    teamPill.hidden = true;
  }
  const roomPill = $('game-room');
  if (room) {
    roomPill.hidden = false;
    roomPill.textContent = `📡 ${room.code}`;
  } else {
    roomPill.hidden = mode !== 'client';
    if (mode === 'client') roomPill.textContent = '📡 in room';
  }

  const active = game.teams[game.activeTeam];
  $('active-team-banner').textContent = `💣 ${active.name} has the bomb`;

  if (lockedHere) {
    $('locked-text').textContent = phase === PHASE.READY
      ? `${active.name} will arm the bomb on their device…`
      : `${active.name} is guessing on their device — get ready, the bomb comes to you next!`;
  }

  if (phase === PHASE.READY) {
    $('ready-text').textContent =
      `${active.name}, grab the ${game.round === 1 ? 'bomb' : 'fresh bomb'}! ` +
      `One player describes, ${active.members > 1 ? 'teammates guess' : 'you act it out'}. Arm it when ready.`;
  }

  if (phase === PHASE.PLAYING) {
    $('game-word').textContent = game.word ?? '…';
    const left = skipsLeft(game);
    const noWords = game.wordsLeft === 0;
    $('skip-count').textContent = noWords
      ? 'no words left'
      : left === Infinity ? 'unlimited' : `${left} left`;
    $('btn-skip').disabled = left === 0 || noWords;
  }

  if (phase === PHASE.BOOM) {
    const victim = game.teams[game.lastBoomTeam];
    $('boom-team').textContent = `${victim.name} exploded!`;
    $('boom-detail').textContent = victim.alive
      ? `${victim.lives} ${victim.lives === 1 ? 'life' : 'lives'} left`
      : `${victim.name} is out of the game!`;
  }

  renderTeamStatus();
  paintFuse();
}

function renderTeamStatus() {
  const el = $('team-status');
  el.innerHTML = '';
  for (const team of game.teams) {
    const line = document.createElement('div');
    line.dataset.teamId = team.id;
    line.className = 'team-line'
      + (team.id === game.activeTeam && team.alive ? ' active-now' : '')
      + (team.alive ? '' : ' dead');
    const hearts = team.alive ? '❤️'.repeat(team.lives) : '💀';
    line.innerHTML = `<span class="name"></span><span class="team-clock"></span><span class="hearts">${hearts}</span><span class="score"></span>`;
    line.querySelector('.name').textContent = team.name;
    line.querySelector('.team-clock').textContent = formatClock(fuseRemainingMs(game, syncedNow(), team.id));
    line.querySelector('.score').textContent = `${team.score} ✓`;
    el.appendChild(line);
  }
}

function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderGameover() {
  const winner = game.winner != null ? game.teams[game.winner] : null;
  $('winner-title').textContent = winner ? `${winner.name} wins! 🎉` : "It's a draw!";
  $('gameover-note').textContent = game.endReason === 'exhausted'
    ? 'You guessed every single word — the deck ran out!'
    : '';
  const scores = $('final-scores');
  scores.innerHTML = '';
  const ranked = [...game.teams].sort((a, b) => (b.alive - a.alive) || (b.score - a.score));
  for (const team of ranked) {
    const line = document.createElement('div');
    line.className = 'team-line';
    line.innerHTML = `<span class="name"></span><span>${team.alive ? '❤️'.repeat(team.lives) : '💀'} · <strong>${team.score} ✓</strong></span>`;
    line.querySelector('.name').textContent = team.name;
    scores.appendChild(line);
  }
  const again = $('btn-again');
  again.hidden = mode === 'client';
}

// Clock painter — every animation frame, from the active team's deadline.
function paintFuse() {
  if (!game || (game.phase !== PHASE.PLAYING && game.phase !== PHASE.READY)) return;
  const totalMs = game.settings.fuseSeconds * 1000;
  const leftMs = fuseRemainingMs(game, syncedNow());
  $('fuse-seconds').textContent = Math.ceil(leftMs / 1000);
  const fusePct = (leftMs / totalMs) * 100;
  $('fuse-bar').style.width = `${fusePct}%`;
  $('fuse-spark').style.left = `${fusePct}%`;
  const wrap = document.querySelector('.fuse-wrap');
  wrap.classList.toggle('fuse-crit', game.phase === PHASE.PLAYING && leftMs <= 10_000);
  wrap.classList.toggle('fuse-warn', game.phase === PHASE.PLAYING && leftMs > 10_000 && leftMs <= 25_000);
  for (const team of game.teams) {
    const clock = document.querySelector(`.team-line[data-team-id="${team.id}"] .team-clock`);
    if (clock) clock.textContent = formatClock(fuseRemainingMs(game, syncedNow(), team.id));
  }
}

(function fuseLoop() {
  paintFuse();
  requestAnimationFrame(fuseLoop);
})();

// =====================================================================
// Lobby editors
// =====================================================================

function persist() {
  saveSettings(settings);
}

function renderLobby() {
  renderTeams();
  renderCategories();
  $('input-fuse').value = settings.fuseSeconds;
  $('fuse-value').textContent = `${settings.fuseSeconds} s`;
  $('input-lives').value = settings.lives;
  $('lives-value').textContent = settings.lives;
  $('input-skips').value = String(settings.skipsPerPossession);
  $('input-two-devices').checked = settings.twoDevices;
  $('two-devices-host-team').textContent = settings.teams[0].name;
}

function renderTeams() {
  const list = $('team-list');
  list.innerHTML = '';
  settings.teams.forEach((team, i) => {
    const row = document.createElement('div');
    row.className = 'team-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 20;
    name.value = team.name;
    name.placeholder = `Team ${i + 1}`;
    name.addEventListener('input', () => {
      team.name = name.value.trim() || `Team ${i + 1}`;
      if (i === 0) $('two-devices-host-team').textContent = team.name;
      persist();
    });

    const stepper = document.createElement('div');
    stepper.className = 'member-stepper';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${team.members} 👤`;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '＋';
    minus.addEventListener('click', () => {
      team.members = Math.max(1, team.members - 1);
      count.textContent = `${team.members} 👤`;
      persist();
    });
    plus.addEventListener('click', () => {
      team.members = Math.min(12, team.members + 1);
      count.textContent = `${team.members} 👤`;
      persist();
    });
    stepper.append(minus, count, plus);

    row.append(name, stepper);
    list.appendChild(row);
  });
}

function renderCategories() {
  const grid = $('category-chips');
  grid.innerHTML = '';
  const all = [...BUILTIN_CATEGORIES, ...customCategories];
  for (const cat of all) {
    const chip = document.createElement('button');
    chip.type = 'button';
    const selected = settings.categoryIds.includes(cat.id);
    chip.className = 'chip' + (selected ? ' selected' : '');
    chip.textContent = `${cat.emoji} ${cat.name} (${cat.words.length})`;
    if (cat.custom) {
      const x = document.createElement('span');
      x.className = 'chip-x';
      x.textContent = '✕';
      x.setAttribute('aria-label', `Delete ${cat.name}`);
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        customCategories = customCategories.filter((c) => c.id !== cat.id);
        settings.categoryIds = settings.categoryIds.filter((id) => id !== cat.id);
        saveCustomCategories(customCategories);
        persist();
        renderCategories();
      });
      chip.appendChild(x);
    }
    chip.addEventListener('click', () => {
      settings.categoryIds = selected
        ? settings.categoryIds.filter((id) => id !== cat.id)
        : [...settings.categoryIds, cat.id];
      persist();
      renderCategories();
    });
    grid.appendChild(chip);
  }
}

// =====================================================================
// Room (host + join)
// =====================================================================

async function openRoom() {
  const btn = $('btn-open-room');
  const errEl = $('room-error');
  btn.disabled = true;
  errEl.hidden = true;
  try {
    room = await hostRoom({
      onAction: (a, team) => applyAction(a, team),
      onPeers: (n) => {
        peerCount = n;
        $('room-peers').textContent = n;
        broadcast(); // make sure fresh joiners get the current state immediately
        render();    // host may need to (un)lock if the other device left
      },
      onError: (message) => {
        errEl.textContent = message;
        errEl.hidden = false;
      },
    });
    mode = 'host';
    $('room-closed').hidden = true;
    $('room-open').hidden = false;
    $('room-code').textContent = room.code;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

async function join() {
  const code = normalizeCode($('input-join-code').value);
  const errEl = $('home-error');
  errEl.hidden = true;
  if (code.length < 4) {
    errEl.textContent = 'Enter the 4-letter room code.';
    errEl.hidden = false;
    return;
  }
  const btn = $('btn-join');
  btn.disabled = true;
  btn.textContent = 'Joining…';
  try {
    client = await joinRoom(code, {
      onState: (state, hostNow) => {
        clockOffset = hostNow - Date.now();
        game = state;
        render();
      },
      onRole: (team) => {
        clientTeam = team;
        if (game) render();
      },
      onClose: (message) => {
        mode = 'local';
        client = null;
        clientTeam = null;
        game = null;
        $('screen-boom').hidden = true;
        showScreen('screen-home');
        errEl.textContent = message;
        errEl.hidden = false;
      },
    });
    mode = 'client';
    game = { phase: PHASE.LOBBY };
    render();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Join room';
  }
}

// =====================================================================
// Custom category dialog
// =====================================================================

function openCategoryDialog() {
  $('input-cat-name').value = '';
  $('input-cat-words').value = '';
  $('cat-error').hidden = true;
  $('dialog-category').showModal();
}

function saveCategory(e) {
  e.preventDefault();
  const name = $('input-cat-name').value.trim();
  const words = parseWordList($('input-cat-words').value);
  const errEl = $('cat-error');
  if (!name || words.length < 5) {
    errEl.textContent = 'Give it a name and at least 5 words.';
    errEl.hidden = false;
    return;
  }
  const cat = makeCustomCategory(name, words);
  customCategories.push(cat);
  settings.categoryIds.push(cat.id); // new category starts selected
  saveCustomCategories(customCategories);
  persist();
  renderCategories();
  $('dialog-category').close();
}

// =====================================================================
// Event wiring
// =====================================================================

$('btn-setup').addEventListener('click', () => {
  renderLobby();
  showScreen('screen-lobby');
});
$('btn-back-home').addEventListener('click', () => showScreen('screen-home'));
$('btn-join').addEventListener('click', join);

$('btn-how-to-play').addEventListener('click', () => {
  $('dialog-how-to-play').showModal();
});
$('btn-close-how-to-play').addEventListener('click', () => {
  $('dialog-how-to-play').close();
});
$('input-join-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') join();
});

$('btn-add-category').addEventListener('click', openCategoryDialog);
$('form-category').addEventListener('submit', saveCategory);
$('btn-cat-cancel').addEventListener('click', () => $('dialog-category').close());

$('input-fuse').addEventListener('input', (e) => {
  settings.fuseSeconds = Number(e.target.value);
  $('fuse-value').textContent = `${settings.fuseSeconds} s`;
  persist();
});
$('input-lives').addEventListener('input', (e) => {
  settings.lives = Number(e.target.value);
  $('lives-value').textContent = settings.lives;
  persist();
});
$('input-skips').addEventListener('change', (e) => {
  settings.skipsPerPossession = Number(e.target.value);
  persist();
});
$('input-two-devices').addEventListener('change', (e) => {
  settings.twoDevices = e.target.checked;
  persist();
  broadcast(); // joined devices update their "you are team X" hint
});

$('btn-open-room').addEventListener('click', openRoom);
$('btn-start').addEventListener('click', beginGame);

$('btn-arm').addEventListener('click', () => {
  if (isAuthority()) applyAction('arm');
  else client?.send('arm');
});
$('btn-correct').addEventListener('click', () => {
  if (isAuthority()) applyAction('correct');
  else client?.send('correct');
});
$('btn-skip').addEventListener('click', () => {
  if (isAuthority()) applyAction('skip');
  else client?.send('skip');
});

$('btn-again').addEventListener('click', backToLobby);

// Keep the screen awake during play where supported.
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch { /* not critical */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock?.released !== false) requestWakeLock();
});
requestWakeLock();

showScreen('screen-home');

// localStorage persistence for settings and custom categories.

const SETTINGS_KEY = 'xsec.settings.v1';
const CUSTOM_KEY = 'xsec.customCategories.v1';
const USED_WORDS_KEY = 'xsec.usedWords.v1';
const PLAYER_SESSIONS_KEY = 'xsec.playerSessions.v1';

// action -> KeyboardEvent.key. null means unbound.
export const DEFAULT_KEY_BINDINGS = {
  skip: 'ArrowLeft',
  correct: 'ArrowRight',
  arm: 'ArrowUp',
};

export const DEFAULT_SETTINGS = {
  fuseSeconds: 60,
  lives: 3,
  skipsPerPossession: -1, // unlimited
  twoDevices: false, // each team on its own device (needs an open room)
  categoryIds: ['animals', 'actions', 'objects'],
  teams: [
    { name: 'Team Dynamite', members: 2 },
    { name: 'Team Firecracker', members: 2 },
  ],
  keyBindings: DEFAULT_KEY_BINDINGS,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked — the game still works for this session
  }
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY, null);
  const settings = saved
    ? { ...structuredClone(DEFAULT_SETTINGS), ...saved }
    : structuredClone(DEFAULT_SETTINGS);
  // The game is strictly head-to-head: exactly 2 teams.
  settings.teams = settings.teams.slice(0, 2);
  while (settings.teams.length < 2) {
    settings.teams.push(structuredClone(DEFAULT_SETTINGS.teams[settings.teams.length]));
  }
  // Merge per-action so a settings blob saved before this feature existed
  // (or missing just one rebound action) still fills in the rest.
  settings.keyBindings = { ...structuredClone(DEFAULT_KEY_BINDINGS), ...(saved?.keyBindings || {}) };
  return settings;
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function loadCustomCategories() {
  return read(CUSTOM_KEY, []);
}

export function saveCustomCategories(categories) {
  write(CUSTOM_KEY, categories);
}

export function parseWordList(text) {
  return [...new Set(
    text
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean)
  )];
}

export function makeCustomCategory(name, words) {
  return {
    id: 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    emoji: '✨',
    words,
    custom: true,
  };
}

export function wordKey(word) {
  return word.trim().toLowerCase();
}

export function loadUsedWords() {
  const saved = read(USED_WORDS_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.filter((key) => typeof key === 'string');
}

export function saveUsedWords(keys) {
  write(USED_WORDS_KEY, [...new Set(keys)]);
}

export function markWordUsed(word) {
  if (!word) return;
  const key = wordKey(word);
  const used = loadUsedWords();
  if (used.includes(key)) return;
  saveUsedWords([...used, key]);
}

export function resetUsedWords() {
  saveUsedWords([]);
}

export function filterUnusedWords(words, usedWords = loadUsedWords()) {
  const used = new Set(usedWords);
  return words.filter((word) => !used.has(wordKey(word)));
}

export function loadPlayerSession(code) {
  const sessions = read(PLAYER_SESSIONS_KEY, {});
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) return null;
  const session = sessions[String(code || '').toUpperCase()];
  return session && typeof session.resumeToken === 'string' && session.resumeToken
    ? { resumeToken: session.resumeToken }
    : null;
}

export function savePlayerSession(code, session) {
  const roomCode = String(code || '').toUpperCase();
  if (!roomCode || !session?.resumeToken) return;
  const saved = read(PLAYER_SESSIONS_KEY, {});
  const sessions = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  sessions[roomCode] = { resumeToken: session.resumeToken };
  write(PLAYER_SESSIONS_KEY, sessions);
}

export function createResumeToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure browser storage is unavailable');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((n) => n.toString(16).padStart(2, '0')).join('');
}

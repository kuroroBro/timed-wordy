// localStorage persistence for settings and custom categories.

const SETTINGS_KEY = 'xsec.settings.v1';
const CUSTOM_KEY = 'xsec.customCategories.v1';

export const DEFAULT_SETTINGS = {
  fuseSeconds: 60,
  lives: 3,
  skipsPerPossession: -1, // unlimited
  categoryIds: ['animals', 'actions', 'objects'],
  teams: [
    { name: 'Team Dynamite', members: 2 },
    { name: 'Team Firecracker', members: 2 },
  ],
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
  if (!saved) return structuredClone(DEFAULT_SETTINGS);
  return { ...structuredClone(DEFAULT_SETTINGS), ...saved };
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

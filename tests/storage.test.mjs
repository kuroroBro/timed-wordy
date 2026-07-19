import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPlayerSession, savePlayerSession,
  loadSettings, saveSettings, DEFAULT_KEY_BINDINGS,
} from '../js/storage.js';

const store = new Map();
global.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
};

test.beforeEach(() => store.clear());

test('loadSettings falls back to default key bindings when none are saved', () => {
  const settings = loadSettings();
  assert.deepEqual(settings.keyBindings, DEFAULT_KEY_BINDINGS);
});

test('loadSettings fills in a missing action from a partial saved binding', () => {
  saveSettings({ keyBindings: { skip: 'a' } });
  const settings = loadSettings();
  assert.equal(settings.keyBindings.skip, 'a');
  assert.equal(settings.keyBindings.correct, DEFAULT_KEY_BINDINGS.correct);
  assert.equal(settings.keyBindings.arm, DEFAULT_KEY_BINDINGS.arm);
});

test('loadSettings keeps a fully custom set of key bindings intact', () => {
  saveSettings({ keyBindings: { skip: 'j', correct: 'k', arm: null } });
  const settings = loadSettings();
  assert.deepEqual(settings.keyBindings, { skip: 'j', correct: 'k', arm: null });
});

test('remote-team sessions persist independently by normalized room code', () => {
  savePlayerSession('ab12', { resumeToken: 'secret-a' });
  savePlayerSession('CD34', { resumeToken: 'secret-b' });
  assert.deepEqual(loadPlayerSession('AB12'), { resumeToken: 'secret-a' });
  assert.deepEqual(loadPlayerSession('cd34'), { resumeToken: 'secret-b' });
});

test('malformed remote-team sessions are ignored', () => {
  localStorage.setItem('xsec.playerSessions.v1', JSON.stringify({ TEST: {} }));
  assert.equal(loadPlayerSession('TEST'), null);
});

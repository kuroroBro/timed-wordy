import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlayerSession, savePlayerSession } from '../js/storage.js';

const store = new Map();
global.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
};

test.beforeEach(() => store.clear());

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

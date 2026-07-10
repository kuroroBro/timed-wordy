import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE, UNLIMITED_SKIPS,
  createGame, startGame, armBomb, markCorrect, skipWord,
  explodeIfDue, continueAfterBoom, skipsLeft, fuseRemainingMs,
} from '../js/game.js';

const rng = () => 0.5; // deterministic shuffles
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

function freshGame(overrides = {}) {
  const state = createGame({
    fuseSeconds: 60,
    lives: 2,
    skipsPerPossession: 1,
    teams: [{ name: 'Red' }, { name: 'Blue' }, { name: 'Green' }],
    ...overrides,
  });
  return state;
}

test('startGame requires lobby phase, 2+ teams and words', () => {
  const solo = createGame({ teams: [{ name: 'Only' }] });
  assert.equal(startGame(solo, WORDS, rng), false);

  const state = freshGame();
  assert.equal(startGame(state, [], rng), false);
  assert.equal(startGame(state, WORDS, rng), true);
  assert.equal(state.phase, PHASE.READY);
  assert.equal(state.round, 1);
  assert.equal(startGame(state, WORDS, rng), false); // not in lobby anymore
});

test('armBomb lights the shared fuse and deals a word', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  assert.equal(fuseRemainingMs(state, 0), 60_000); // full fuse shown while ready
  assert.equal(armBomb(state, 1000, rng), true);
  assert.equal(state.phase, PHASE.PLAYING);
  assert.equal(state.fuseDeadline, 61_000);
  assert.ok(WORDS.includes(state.word));
  assert.equal(fuseRemainingMs(state, 31_000), 30_000);
});

test('markCorrect passes the bomb without touching the fuse', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  const deadline = state.fuseDeadline;
  const firstWord = state.word;
  assert.equal(markCorrect(state, 10_000, rng), true);
  assert.equal(state.teams[0].score, 1);
  assert.equal(state.activeTeam, 1);
  assert.equal(state.fuseDeadline, deadline); // shared bomb keeps burning
  assert.notEqual(state.word, firstWord);
});

test('skip limit is per possession and resets on correct', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  assert.equal(skipsLeft(state), 1);
  assert.equal(skipWord(state, 1000, rng), true);
  assert.equal(skipWord(state, 2000, rng), false); // limit hit
  markCorrect(state, 3000, rng);
  assert.equal(skipsLeft(state), 1); // fresh possession, fresh skips
});

test('unlimited skips', () => {
  const state = freshGame({ skipsPerPossession: UNLIMITED_SKIPS });
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  for (let i = 0; i < 10; i++) assert.equal(skipWord(state, i, rng), true);
  assert.equal(skipsLeft(state), Infinity);
});

test('explosion costs the holder a life; late actions lose the race', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  assert.equal(explodeIfDue(state, 59_999), false);
  assert.equal(markCorrect(state, 60_000, rng), false); // arrives with the bang
  assert.equal(state.phase, PHASE.BOOM);
  assert.equal(state.teams[0].lives, 1);
  assert.equal(state.teams[0].score, 0); // the late correct did not count
});

test('next round starts with the team after the victim', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  markCorrect(state, 1000, rng); // bomb now with team 1
  explodeIfDue(state, 60_000);
  assert.equal(state.lastBoomTeam, 1);
  assert.equal(continueAfterBoom(state), true);
  assert.equal(state.phase, PHASE.READY);
  assert.equal(state.round, 2);
  assert.equal(state.activeTeam, 2);
});

test('elimination skips dead teams; last team standing wins', () => {
  const state = freshGame({ lives: 1, teams: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  startGame(state, WORDS, rng);
  armBomb(state, 0, rng);
  explodeIfDue(state, 60_000); // A eliminated (1 life)
  assert.equal(state.teams[0].alive, false);
  continueAfterBoom(state);
  assert.equal(state.activeTeam, 1);
  armBomb(state, 100_000, rng);
  markCorrect(state, 100_500, rng);
  assert.equal(state.activeTeam, 2); // passes B -> C, never back to dead A
  explodeIfDue(state, 160_000); // C eliminated -> B wins
  assert.equal(state.phase, PHASE.GAMEOVER);
  assert.equal(state.winner, 1);
});

test('deck reshuffles used words when exhausted, never goes empty', () => {
  const state = freshGame({ skipsPerPossession: UNLIMITED_SKIPS });
  startGame(state, ['one', 'two'], rng);
  armBomb(state, 0, rng);
  const seen = new Set([state.word]);
  for (let i = 0; i < 6; i++) {
    assert.equal(skipWord(state, i, rng), true);
    assert.ok(state.word != null);
    seen.add(state.word);
  }
  assert.deepEqual([...seen].sort(), ['one', 'two']);
});

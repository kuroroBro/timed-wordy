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

test('armBomb starts the active team clock and deals a word', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  assert.equal(fuseRemainingMs(state, 0), 60_000); // full fuse shown while ready
  assert.equal(armBomb(state, 1000), true);
  assert.equal(state.phase, PHASE.PLAYING);
  assert.equal(state.fuseDeadline, 61_000);
  assert.ok(WORDS.includes(state.word));
  assert.equal(fuseRemainingMs(state, 31_000), 30_000);
});

test('markCorrect pauses one team clock and starts the other clock', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0);
  const firstWord = state.word;
  assert.equal(markCorrect(state, 10_000), true);
  assert.equal(state.teams[0].score, 1);
  assert.equal(state.activeTeam, 1);
  assert.equal(state.teams[0].timeRemainingMs, 50_000);
  assert.equal(state.teams[1].timeRemainingMs, 60_000);
  assert.equal(state.fuseDeadline, 70_000);
  assert.equal(fuseRemainingMs(state, 20_000, 0), 50_000);
  assert.equal(fuseRemainingMs(state, 20_000, 1), 50_000);
  assert.notEqual(state.word, firstWord);
});

test('skip limit is per possession and resets on correct', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0);
  assert.equal(skipsLeft(state), 1);
  assert.equal(skipWord(state, 1000), true);
  assert.equal(skipWord(state, 2000), false); // limit hit
  markCorrect(state, 3000);
  assert.equal(skipsLeft(state), 1); // fresh possession, fresh skips
});

test('unlimited skips (while words remain)', () => {
  const state = freshGame({ skipsPerPossession: UNLIMITED_SKIPS });
  const pool = Array.from({ length: 12 }, (_, i) => `word-${i}`);
  startGame(state, pool, rng);
  armBomb(state, 0);
  const seen = new Set([state.word]);
  for (let i = 0; i < 10; i++) {
    assert.equal(skipWord(state, i), true);
    seen.add(state.word);
  }
  assert.equal(skipsLeft(state), Infinity);
  assert.equal(seen.size, 11); // every deal was a brand-new word
});

test('explosion costs the holder a life; late actions lose the race', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0);
  assert.equal(explodeIfDue(state, 59_999), false);
  assert.equal(markCorrect(state, 60_000), false); // arrives with the bang
  assert.equal(state.phase, PHASE.BOOM);
  assert.equal(state.teams[0].lives, 1);
  assert.equal(state.teams[0].score, 0); // the late correct did not count
});

test('next round starts with the team after the victim', () => {
  const state = freshGame();
  startGame(state, WORDS, rng);
  armBomb(state, 0);
  markCorrect(state, 1000); // bomb now with team 1
  explodeIfDue(state, 61_000);
  assert.equal(state.lastBoomTeam, 1);
  assert.equal(continueAfterBoom(state), true);
  assert.equal(state.phase, PHASE.READY);
  assert.equal(state.round, 2);
  assert.equal(state.activeTeam, 2);
  assert.equal(state.teams[0].timeRemainingMs, 60_000);
  assert.equal(state.teams[1].timeRemainingMs, 60_000);
  assert.equal(state.teams[2].timeRemainingMs, 60_000);
});

test('elimination skips dead teams; last team standing wins', () => {
  const state = freshGame({ lives: 1, teams: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  startGame(state, WORDS, rng);
  armBomb(state, 0);
  explodeIfDue(state, 60_000); // A eliminated (1 life)
  assert.equal(state.teams[0].alive, false);
  continueAfterBoom(state);
  assert.equal(state.activeTeam, 1);
  armBomb(state, 100_000);
  markCorrect(state, 100_500);
  assert.equal(state.activeTeam, 2); // passes B -> C, never back to dead A
  explodeIfDue(state, 160_500); // C eliminated -> B wins
  assert.equal(state.phase, PHASE.GAMEOVER);
  assert.equal(state.winner, 1);
});

test('words are never repeated: skip refuses when the deck is dry', () => {
  const state = freshGame({ skipsPerPossession: UNLIMITED_SKIPS });
  startGame(state, ['one', 'two'], rng);
  armBomb(state, 0);
  const first = state.word;
  assert.equal(skipWord(state, 1000), true);      // deals the second word
  assert.notEqual(state.word, first);
  assert.equal(state.wordsLeft, 0);
  assert.equal(skipWord(state, 2000), false);     // nothing left to swap in
  assert.equal(state.phase, PHASE.PLAYING);       // game continues on the last word
});

test('guessing the last word ends the game; higher score breaks the lives tie', () => {
  const state = freshGame({ teams: [{ name: 'A' }, { name: 'B' }] });
  startGame(state, ['one', 'two'], rng);
  armBomb(state, 0);
  markCorrect(state, 1000);                       // A scores, B gets last word
  assert.equal(markCorrect(state, 2000), true);   // B scores, pool is dry
  assert.equal(state.phase, PHASE.GAMEOVER);
  assert.equal(state.endReason, 'exhausted');
  // Equal lives, equal score (1-1) -> draw
  assert.equal(state.winner, null);
});

test('exhaustion winner: most lives first, then score', () => {
  const state = freshGame({ teams: [{ name: 'A' }, { name: 'B' }] });
  startGame(state, ['one', 'two', 'three'], rng);
  armBomb(state, 0);
  explodeIfDue(state, 60_000);                    // A loses a life
  continueAfterBoom(state);                       // B starts round 2
  armBomb(state, 100_000);                        // deals 2nd word
  markCorrect(state, 100_500);                    // B scores, A gets 3rd word
  assert.equal(markCorrect(state, 101_000), true); // A scores, pool dry
  assert.equal(state.phase, PHASE.GAMEOVER);
  assert.equal(state.endReason, 'exhausted');
  assert.equal(state.winner, 1);                  // B has 2 lives vs A's 1
});

test('arming with an empty deck ends the game instead of dealing', () => {
  const state = freshGame({ teams: [{ name: 'A' }, { name: 'B' }] });
  startGame(state, ['one'], rng);
  armBomb(state, 0);
  markCorrect(state, 1000);                       // last word guessed mid-round
  assert.equal(state.phase, PHASE.GAMEOVER);      // ends right away, no empty READY
  assert.equal(state.winner, 0);                  // A: 1 point vs B: 0
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { rhythmScore } from '../src/minigames.js';

test('normal rhythm boundaries award exact, near and missed notes symmetrically', () => {
  for (const sign of [-1, 1]) {
    assert.equal(rhythmScore(sign * 180), 100);
    assert.equal(rhythmScore(sign * 180.01), 70);
    assert.equal(rhythmScore(sign * 320), 70);
    assert.equal(rhythmScore(sign * 320.01), 0);
  }
  assert.equal(rhythmScore(0), 100);
});

test('comfortable mode expands both timing windows without penalizing precise input', () => {
  for (const sign of [-1, 1]) {
    assert.equal(rhythmScore(sign * 250, true), 100);
    assert.equal(rhythmScore(sign * 250.01, true), 70);
    assert.equal(rhythmScore(sign * 450, true), 70);
    assert.equal(rhythmScore(sign * 450.01, true), 0);
  }
  for (let delta = -600; delta <= 600; delta += 1) {
    assert.ok(rhythmScore(delta, true) >= rhythmScore(delta));
  }
});

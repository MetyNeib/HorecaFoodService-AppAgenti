import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectCommand, parseCents } from 'hfs/domain';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/domain-parity.json', import.meta.url), 'utf8'));
const initial = fixture.initialState;
const expectedState = step => ({ ...initial, ...step.expected, data: { ...initial.data, ...step.expected.data } });

test('all eight essential offline commands match Ruby state exactly, including money and future conditions', () => {
  let state = structuredClone(initial);
  for (const [index, step] of fixture.steps.entries()) {
    const before = structuredClone(state);
    const next = projectCommand(state, step.command);
    assert.deepEqual(state, before, `Command ${index} mutated its input`);
    assert.deepEqual(next, expectedState(step), `Ruby/JavaScript divergence at step ${index}: ${step.command.type}`);
    state = next;
  }
});

for (const [index, rejected] of fixture.rejectedCases.entries()) {
  test(`offline validation rejects the same unsafe intent as Ruby (${index}: ${rejected.type})`, () => {
    const state = expectedState(fixture.steps[rejected.afterStep]);
    const before = structuredClone(state);
    assert.throws(() => projectCommand(state, { type: rejected.type, payload: rejected.payload }));
    assert.deepEqual(state, before, 'Failed commands must not modify the saved state');
  });
}

test('Italian cents parsing trims surrounding whitespace without changing fractional digits', () => {
  assert.equal(parseCents(' 1,2 '), 120);
  assert.equal(parseCents('1,25'), 125);
  assert.throws(() => parseCents('1,255'));
});

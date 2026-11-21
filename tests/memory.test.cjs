const test = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('./game-fixture.cjs');

function visit(storage, year, month, day) {
  // The learner is playing late at night in their own time zone.
  const instant = new Date(year, month - 1, day, 23, 57).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
  }
  return openGame(storage, Clock);
}

function practice(session, mission, assist) {
  session.click('recall', mission.id);
  if (assist === 'hint') session.click('hint');
  if (assist === 'retry') session.click('answer', (mission.recall.answer + 1) % 3);
  session.click('answer', mission.recall.answer);
}

test('local-day appointments expand only after due, unassisted recall and restart after a lapse', () => {
  const storage = new Map();
  let session = visit(storage, 2026, 3, 7);
  const mission = session.missions[0];
  const appointment = () => session.game.getState().reviewSchedule[mission.id];
  const dueCount = () => session.game.getState().dueReviews.length;
  session.solve(mission);
  assert.equal(appointment().due, '2026-03-08');
  assert.equal(dueCount(), 0);
  practice(session, mission);
  practice(session, mission);
  session.solve(mission);
  assert.equal(appointment().due, '2026-03-08');

  session = visit(storage, 2026, 3, 8);
  assert.equal(dueCount(), 1);
  session.game.openJournal('due');
  assert.match(session.dialog.innerHTML, /今日复习（1）/);
  assert.match(session.dialog.innerHTML, /开始今日复习/);
  practice(session, mission);
  practice(session, mission);
  assert.equal(appointment().due, '2026-03-11');
  session.game.openJournal('due');
  assert.match(session.dialog.innerHTML, /今天的复习完成了/);

  session = visit(storage, 2026, 3, 11);
  practice(session, mission);
  assert.equal(appointment().due, '2026-03-18');
  session = visit(storage, 2026, 3, 21);
  practice(session, mission);
  assert.equal(appointment().due, '2026-03-28');

  session = visit(storage, 2026, 3, 22);
  practice(session, mission, 'retry');
  assert.equal(appointment().due, '2026-03-23');
  assert.equal(appointment().stage, 0);
  assert.ok(session.game.getState().reviewed.includes(mission.id));
  session = visit(storage, 2026, 3, 23);
  practice(session, mission, 'hint');
  assert.equal(appointment().due, '2026-03-24');
  assert.equal(session.game.getState().xp, 20 + 4 * 8);
});

test('legacy and malformed schedules offer earned cards today and preserve actual reviewed progress', () => {
  const storage = new Map();
  const first = visit(storage, 2026, 12, 31);
  const [older, legacy, next] = first.missions;
  const key = 'happylearn.islands.field.v1';
  storage.set(key, JSON.stringify({
    completed: [legacy.id, older.id, next.id], reviewed: [legacy.id],
    reviewSchedule: {
      [older.id]: { stage: 1, due: '2026-12-24' },
      [next.id]: { stage: 0, due: '2026-02-31' },
      unrelated: { stage: 0, due: '2026-01-01' }
    }
  }));
  const session = visit(storage, 2026, 12, 31);
  const state = session.game.getState();
  assert.deepEqual(Array.from(state.reviewed), [legacy.id]);
  assert.equal(state.reviewSchedule.unrelated, undefined);
  assert.equal(state.reviewSchedule[legacy.id].stage, -1);
  assert.equal(state.reviewSchedule[next.id].due, '2026-12-31');
  assert.deepEqual(Array.from(state.dueReviews), [older.id, legacy.id, next.id]);

  session.game.openJournal('due');
  assert.ok(session.dialog.innerHTML.includes('data-act="recall" data-value="' + older.id + '"'));
  practice(session, legacy);
  assert.equal(session.game.getState().reviewSchedule[legacy.id].due, '2027-01-01');
  assert.equal(visit(storage, 2027, 1, 1).game.getState().dueReviews.length, 3);
});

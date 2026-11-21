const test = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('./game-fixture.cjs');

test('a learner resumes an unfinished clue, retries an answer and can revisit a memory without duplicating rewards', () => {
  const storage = new Map();
  const firstVisit = openGame(storage);
  const mission = firstVisit.missions[0];
  firstVisit.game.start(mission.subject, mission.id);
  firstVisit.click('inspect', 0);
  const { game, click, solve, dialog } = openGame(storage);
  game.start(mission.subject);
  assert.deepEqual(Array.from(game.getState().active.found), [0]);
  mission.sites.forEach((_, i) => click('inspect', i));
  click('to-choice');
  click('answer', (mission.answer + 1) % mission.options.length);
  assert.equal(game.getState().xp, 0);
  assert.equal(game.getState().mistakes[mission.id], 1);
  click('hint');
  assert.ok(dialog.innerHTML.includes(mission.hint));
  click('answer', mission.answer);
  const xp = game.getState().xp;
  assert.ok(xp > 0);
  solve(mission);
  assert.equal(game.getState().xp, xp);
  game.openJournal();
  click('card', mission.id);
  click('recall', mission.id);
  click('answer', mission.recall.answer);
  assert.ok(game.getState().reviewed.includes(mission.id));
  assert.equal(game.getState().mistakes[mission.id], undefined);
  assert.equal(openGame(storage).game.getState().xp, xp);
});

test('each region grants an expedition stamp and every campaign mission can be completed', () => {
  const { game, missions, subjects, dialog, solve } = openGame();
  game.startMixed();
  assert.equal(game.getState().active, null);
  for (const subject of subjects) solve(missions.find(m => m.subject === subject.id));
  game.startMixed();
  assert.equal(game.getState().active.id, missions.find(m => m.subject === 'mixed').id);
  for (const m of missions) solve(m);
  assert.equal(game.getState().completed.length, missions.length);
  assert.equal(game.getState().shards, missions.length);
  assert.equal(game.getState().active, null);
  game.openAchievements();
  assert.ok(dialog.innerHTML.includes('群岛领航员'));
});

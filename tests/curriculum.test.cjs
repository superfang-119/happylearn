const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {} };
const source = fs.readFileSync(path.join(__dirname, '../dist/content.js'), 'utf8');
vm.runInNewContext(source, sandbox);
const { subjects, missions } = sandbox.window.LEARNING_CONTENT;

// Mission IDs are also saved in players’ local journals and must stay unique.
test('every adventure has a unique ID and belongs to a supported region', () => {
  const subjectIds = new Set(subjects.map(subject => subject.id));
  assert.deepEqual([...subjectIds].sort(), ['chinese', 'english', 'geography', 'history']);
  const allowed = new Set([...subjectIds, 'mixed']);
  assert.equal(new Set(missions.map(mission => mission.id)).size, missions.length);
  for (const mission of missions) {
    assert.ok(typeof mission.id === 'string' && mission.id.trim());
    assert.ok(allowed.has(mission.subject), `${mission.id}: unknown subject`);
  }
  for (const id of allowed) {
    assert.ok(missions.some(mission => mission.subject === id), `${id}: no adventures`);
  }
});

test('every adventure can be learned, solved, and recalled in a new situation', () => {
  for (const mission of missions) {
    for (const key of ['title', 'scene', 'memory']) {
      assert.ok(typeof mission[key] === 'string' && mission[key].trim(), `${mission.id}: ${key}`);
    }
    for (const activity of [mission, mission.recall]) {
      for (const key of ['prompt', 'hint', 'explain']) {
        assert.ok(typeof activity?.[key] === 'string' && activity[key].trim(), `${mission.id}: ${key}`);
      }
      assert.ok(Array.isArray(activity.options) && activity.options.length >= 2, `${mission.id}: missing choices`);
      assert.ok(activity.options.every(option => typeof option === 'string' && option.trim()), `${mission.id}: empty choice`);
      assert.equal(new Set(activity.options).size, activity.options.length, `${mission.id}: duplicate choices`);
      assert.ok(Number.isInteger(activity.answer) && activity.answer >= 0 && activity.answer < activity.options.length, `${mission.id}: invalid answer`);
    }
    assert.notEqual(mission.prompt, mission.recall.prompt, `${mission.id}: repeated recall prompt`);
  }
});

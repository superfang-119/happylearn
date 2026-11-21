const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/city-jobs.js'), 'utf8'), { window });
const { list, create } = window.CityJobs;

function browserStore() {
  const records = new Map();
  return { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
}
function reach(jobs, label) {
  const marker = jobs.markers().find(marker => marker.label === label);
  assert.ok(marker, 'expected physical marker ' + label);
  return jobs.arrive(marker.id);
}
function solve(jobs, id) {
  jobs.start(id);
  let receipt;
  while (jobs.current()) receipt = jobs.arrive(jobs.hint().markerId);
  return receipt;
}

test('commission choices are physical, well separated and within the road network', () => {
  const jobs = create({storage: null});
  assert.equal(list.length, 5);
  assert.equal(jobs.markers().length, 0);
  const roads = [-96, -48, 0, 48, 96];
  const ids = new Set();
  for (const job of list) for (const step of job.steps) {
    assert.ok(step.title && step.clue);
    assert.ok(step.options.length >= 1 && step.options.length <= 3);
    for (const marker of step.options) {
      assert.ok(!ids.has(marker.id));
      ids.add(marker.id);
      assert.ok(Math.abs(marker.x) <= 132 && Math.abs(marker.z) <= 132);
      assert.ok(roads.some(axis => Math.abs(axis-marker.x) <= 6 || Math.abs(axis-marker.z) <= 6));
      for (const other of step.options.filter(other => other !== marker)) {
        assert.ok(Math.hypot(marker.x-other.x, marker.z-other.z) >= 20);
      }
    }
  }
});

test('deliver English package through physical stops, wrong address and hint; resume after closing or switching jobs', () => {
  const storage = browserStore();
  let jobs = create({ storage });
  assert.equal(jobs.start('city-relay').type, 'locked');
  assert.equal(jobs.start('city-english').type, 'started');
  const contact = jobs.markers()[0];
  assert.equal(contact.x, 6);
  assert.equal(contact.z, -24);
  assert.equal(jobs.arrive(contact.id).type, 'progress');
  assert.equal(jobs.arrive(contact.id).type, 'invalid');
  assert.equal(jobs.current().kind, 'pickup');
  assert.equal(jobs.start('city-geography').type, 'busy');
  assert.equal(reach(jobs, 'RED · 红色货柜').type, 'wrong');
  assert.ok(jobs.markers().every(marker => !marker.highlighted));
  assert.equal(jobs.hint().type, 'hint');
  assert.equal(jobs.markers().filter(marker => marker.highlighted).length, 1);
  jobs = create({ storage });
  assert.equal(jobs.current().step, 1);
  assert.ok(jobs.markers().find(marker => marker.highlighted).label.includes('BLUE'));
  assert.equal(jobs.pause().type, 'paused');
  jobs.start('city-geography');
  jobs.pause();
  assert.equal(jobs.start('city-english').type, 'resumed');
  assert.equal(reach(jobs, 'BLUE · 蓝色货柜').type, 'progress');
  assert.ok(jobs.markers().every(marker => !marker.highlighted));
  assert.equal(reach(jobs, '红牌 · East Stop').type, 'wrong');
  const completed = reach(jobs, '蓝牌 · East Stop');
  assert.equal(completed.type, 'completed');
  assert.equal(completed.fresh, true);
  assert.equal(jobs.getState().memories.length, 1);
  assert.equal(jobs.getState().active, null);
  assert.equal(jobs.arrive(contact.id).type, 'inactive');
  assert.equal(solve(jobs, 'city-english').fresh, false);
  assert.equal(jobs.getState().completed.length, 1);
});

test('four original city cards unlock the repeatable relay and never duplicate rewards', () => {
  const storage = browserStore();
  let jobs = create({storage});
  for (const job of list.filter(job => job.subject !== 'mixed')) {
    assert.equal(jobs.isUnlocked('city-relay'), false);
    const result = solve(jobs, job.id);
    assert.equal(result.fresh, true);
    assert.ok(result.memory && result.livery);
    jobs = create({storage});
  }
  assert.equal(jobs.isUnlocked('city-relay'), true);
  assert.equal(jobs.getState().memories.length, 4);
  assert.equal(solve(jobs, 'city-relay').fresh, true);
  assert.equal(solve(jobs, 'city-relay').fresh, false);
  const progress = jobs.getState();
  assert.equal(progress.completed.length, 5);
  assert.equal(progress.memories.length, 4);
  const restored = create({ storage:null, progress });
  progress.completed.length = 0;
  assert.equal(restored.getState().completed.length, 5);
});

test('bad storage, invalid checkpoints and locked relay entries cannot create progress', () => {
  const progress = {
    completed: ['city-relay', 'unknown', 'city-geography', 'city-geography'],
    checkpoints: {'city-history':{step:99}, 'city-relay':{step:1}},
    active: 'city-history'
  };
  const storage = {getItem: () => '{broken-json', setItem() {throw new Error('no storage');}};
  assert.equal(create({storage}).getState().completed.length, 0);
  const jobs = create({storage, progress});
  assert.deepEqual(Array.from(jobs.getState().completed), ['city-geography']);
  assert.equal(jobs.current(), null);
  assert.equal(jobs.isUnlocked('city-relay'), false);
  assert.equal(solve(jobs,'city-history').fresh, true);
  assert.equal(jobs.getState().memories.length, 2);
});

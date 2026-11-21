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

test('English adds twelve sequential skills and every point has three distinct exercises and a short bilingual speech model',()=>{
  const env={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/learn-facts.js'),'utf8'),env);
  const facts=env.window.LearnFacts;
  const english=missions.filter(m=>m.subject==='english');
  const expected=[
    'en-name','en-colour','en-under','en-family','en-supplies','en-subject',
    'en-be','en-possessive','en-article','en-demonstrative','en-plural','en-be-question',
    'en-greeting','en-can','en-third-person','en-do-question','en-weekday','en-clock'
  ];
  assert.deepEqual(Array.from(english,m=>m.id),expected);
  const translated=new Set();
  const positions=[new Set(),new Set(),new Set()];
  for(const [n,m] of english.entries()) {
    const f=facts[m.id];
    assert.ok(f.lesson.trim() && f.topic.trim(),m.id);
    assert.match(f.model.en,/^[A-Za-z][A-Za-z ,.'’?!-]*[.!?]$/);
    assert.match(f.model.zh,/[\u4e00-\u9fff]/);
    assert.ok(f.model.en.split(/\s+/).length<=12,m.id+' model length');
    assert.ok(!translated.has(f.model.en));translated.add(f.model.en);
    const items=[m,m.recall,f.practice];
    assert.equal(new Set(items.map(v=>v.prompt)).size,3,m.id+' distinct contexts');
    for(const [index,item] of items.entries()) {
      assert.equal(item.options.length,3,m.id);
      assert.equal(new Set(item.options).size,3,m.id);
      assert.ok(Number.isInteger(item.answer)&&item.answer>=0&&item.answer<3,m.id);
      assert.ok(item.hint.trim()&&item.explain.trim(),m.id);
      if(n>=6)positions[index].add(item.answer);
    }
    assert.ok(!f.practice.options.includes(f.model.en),m.id+' model should transfer to a different example');
  }
  for(const used of positions)assert.equal(used.size,3);
});

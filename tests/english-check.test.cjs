const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');

const dist = name => fs.readFileSync(path.join(__dirname, '../dist', name+'.js'), 'utf8');
const engineSource = dist('english-check');
const storageKey = 'happylearn.english.check.v1';
const skills = ['listening', 'spelling', 'grammar', 'reading', 'writing'];
const answerKey = {
  listening: ['直尺','借入','口渴的','图书馆','在……之前','安静的','穿过，到对面','雨伞'],
  spelling: ['pen','Monday','brother','science','twenty','library','blue','breakfast'],
  grammar: ['are','has','We','Her','Does','are','drinks','play'],
  reading: ['九点','画画','在妈妈的书桌上','绿色盒子','乘公共汽车','有两颗黄色星星的蓝包','校门口','午饭后'],
  writing: ['My name is Mei.','Those are my books.','Can he swim?','We read English every day.',
    'There are two pens in my bag.','Where is the library?','She does not like milk.','What colour is his bike?']
};
function visit(storage=new Map(), clock={date:1}, options={}) {
  const journal=[];
  const window={LearnJournal:{record:e=>journal.push(e)},addEventListener(){}};
  const localStorage={
    getItem:k=>storage.get(k)??null,
    setItem:(k,v)=>{if(options.readOnly)throw Error('quota'); storage.set(k,v);}
  };
  class LocalDate extends Date {
    constructor(...args){super(...(args.length?args:[2026,10,clock.date,0,0,1]));}
  }
  const env=vm.createContext({window,localStorage,Date:LocalDate,document:{addEventListener(){}}});
  vm.runInContext(engineSource,env);
  return {api:window.EnglishCheck,journal,storage,clock,window,env};
}
function solution(q){
  return answerKey[q.skill][Number(q.id.split('-').pop())-1];
}
function orderOf(chunks,sentence){
  if(!sentence)return [];
  const first=chunks.find(chunk=>sentence===chunk||sentence.startsWith(chunk+' '));
  assert.ok(first,'unique next chunk in '+sentence);
  return [first,...orderOf(chunks.filter(c=>c!==first),sentence.slice(first.length).trimStart())];
}
function solve(q){
  const key=solution(q);
  assert.ok(key,q.id);
  if(q.type==='order')return orderOf(Array.from(q.options),key);
  if(q.type==='choice'){
    const index=q.options.indexOf(key);
    assert.notEqual(index,-1,q.id);
    return index;
  }
  return key.toUpperCase()+'  ';
}
function finish(api,state=api.getState()){
  const ids=[];
  while(state.phase==='question'||state.phase==='feedback'){
    ids.push(state.question.id);
    if(state.phase==='question')assert.equal(api.answer(solve(state.question)).feedback.kind,'correct',state.question.id);
    state=api.next();
  }
  assert.equal(state.phase,'complete');
  return ids;
}
test('five-skill diagnostic, new forms, three targeted items, and review without repeating the previous form',()=>{
  const {api}=visit();
  assert.equal(api.getState().phase,'idle');
  assert.deepEqual(Object.keys(api.stats().bySkill),skills);
  const first=api.startDiagnostic();
  const q=first.question;
  assert.equal(first.total,5);
  assert.equal(first.position,1);
  assert.equal(q.skill,'listening');
  assert.equal(api.next().question.id,q.id);
  assert.equal(api.startPractice('no-such-skill').question.id,q.id);
  const checked=finish(api);
  assert.deepEqual(checked.map(id=>id.split('-')[1]),skills);
  const summary=api.getState().summary;
  assert.equal(summary.assessed,5);
  assert.equal(summary.correct,5);
  assert.equal(api.getState().feedback,null);
  const focused=finish(api,api.startPractice('grammar'));
  assert.equal(focused.length,3);
  assert.ok(focused.every(id=>!checked.includes(id)));
  const again=finish(api,api.startPractice('grammar'));
  assert.ok(again.every(id=>!focused.includes(id)));
  const second=finish(api,api.startDiagnostic());
  assert.ok(second.every(id=>!checked.includes(id)));
});
test('all forty original questions have unique scenarios, answer keys, explanations and eight separate usable offline recordings',()=>{
  const {api,env,window}=visit();
  for(const source of ['word-audio-data','word-audio'])vm.runInContext(dist(source),env);
  const clips=new Set();
  for(const skill of skills){
    const seen=new Set(),scenarios=new Set(),explanations=new Set();
    for(let run=0;run<6&&seen.size<8;run++){
      let state=api.startPractice(skill);
      while(state.phase==='question'){
        const q=state.question;
        assert.equal(q.skill,skill);
        assert.equal(q.correct,undefined);
        assert.equal(q.key,undefined);
        assert.equal(q.explain,undefined);
        assert.equal(state.feedback,null);
        assert.equal(new Set(q.options).size,q.options.length);
        if(q.type==='order')assert.notEqual(q.options.join(' '),solution(q));
        if(skill==='reading')assert.ok(q.passage.length>35);
        if(skill==='listening'){
          assert.ok(window.WordAudio.has(q.audioWord),q.audioWord);
          const recording=Buffer.from(window.WordRecordings[q.audioWord],'base64');
          assert.ok(recording.length>350 && recording[0]===255 && (recording[1]&224)===224);
          clips.add(createHash('sha256').update(recording).digest('hex'));
          const visible=[q.id,q.prompt,q.instruction,q.passage,...q.options].join(' ').toLowerCase();
          assert.ok(!visible.includes(q.audioWord),'target should be audio only: '+q.audioWord);
        }
        const judged=api.answer(solve(q));
        assert.equal(judged.feedback.kind,'correct',q.id);
        assert.equal(judged.feedback.answerText,solution(q));
        assert.ok(judged.feedback.explain.length>12,q.id);
        seen.add(q.id); explanations.add(judged.feedback.explain);
        scenarios.add(q.audioWord||q.passage||q.prompt);
        state=api.next();
      }
    }
    assert.equal(seen.size,8,skill);
    assert.equal(scenarios.size,8,skill);
    assert.equal(explanations.size,8,skill);
  }
  assert.equal(clips.size,8);
});
test('interruption preserves unanswered and feedback states across modes, records only first valid submission in journal',()=>{
  const storage=new Map([['happylearn.legacy','old progress']]);
  let {api,journal}=visit(storage);
  const first=api.startDiagnostic().question;
  assert.equal(api.answer(null).feedback.kind,'empty');
  assert.equal(api.answer(100).phase,'question');
  assert.equal(api.stats().bySkill.listening.attempts,0);
  assert.equal(journal.length,0);
  const mistake=(solve(first)+1)%first.options.length;
  assert.equal(api.answer(mistake).feedback.kind,'wrong');
  assert.equal(api.skip().feedback.kind,'wrong');
  assert.equal(api.answer(solve(first)).feedback.kind,'wrong');
  assert.equal(journal.length,1);
  const entry=journal[0];
  assert.equal(entry.id,first.id);assert.equal(entry.source,'check');assert.equal(entry.subject,'english');
  assert.equal(entry.outcome,'wrong');assert.ok(entry.note.includes(solution(first)));assert.ok(entry.title.includes('听辨'));
  const practice=api.startPractice('reading');
  assert.equal(practice.feedback,null);
  ({api,journal}=visit(storage));
  assert.equal(api.getState().question.id,practice.question.id);
  const back=api.startDiagnostic();
  assert.equal(back.phase,'feedback');assert.equal(back.question.id,first.id);
  assert.equal(back.feedback.kind,'wrong');assert.equal(api.stats().bySkill.listening.wrong,1);
  assert.equal(journal.length,0);
  const spelling=api.next();
  assert.equal(spelling.phase,'question');assert.equal(spelling.feedback,null);
  assert.equal(spelling.question.skill,'spelling');
  assert.ok(!('answerText' in spelling.results[0]));
  assert.equal(api.answer('   ').feedback.kind,'empty');
  assert.equal(api.skip('audio-unavailable').phase,'question');
  assert.equal(api.skip().feedback.kind,'skipped');
  assert.equal(api.stats().bySkill.spelling.needsPractice,true);
  assert.equal(journal[0].outcome,'skipped');
  assert.equal(storage.get('happylearn.legacy'),'old progress');
});
test('device audio failure has no knowledge judgment, daily attempt, journal entry or reward',()=>{
  const {api,journal,window}=visit();
  window.Game={rewardVocabulary(){assert.fail('check must not pay vocabulary bonuses');}};
  api.startDiagnostic();
  const skipped=api.skip('audio-unavailable');
  assert.equal(skipped.feedback.kind,'unavailable');
  assert.equal(skipped.summary.unavailable,1);
  assert.equal(skipped.summary.assessed,0);
  assert.equal(skipped.feedback.answerText,'');
  assert.equal(journal.length,0);
  const stats=api.stats().bySkill.listening;
  assert.equal(stats.attempts,0);assert.equal(stats.days,0);assert.equal(stats.needsPractice,false);
  api.next();
  assert.equal(api.skip('audio-unavailable').phase,'question');
});
test('a prior error requires independent recalls on distinct local dates and items before retention; subsequent misses reopen it',()=>{
  const {api,clock,storage}=visit();
  let state=api.startPractice('grammar');
  const first=state.question;
  api.answer((solve(first)+1)%first.options.length);
  assert.ok(api.stats().weakSkills.includes('grammar'));
  state=api.next();api.answer(solve(state.question));state=api.next();api.answer(solve(state.question));
  let stats=api.stats().bySkill.grammar;
  assert.equal(stats.correct,2);assert.equal(stats.correctDays,1);assert.equal(stats.retained,false);
  assert.equal(stats.needsPractice,true);
  api.next();clock.date=2;
  state=api.startPractice('grammar');api.answer(solve(state.question));
  stats=visit(storage,clock).api.stats().bySkill.grammar;
  assert.equal(stats.days,2);assert.equal(stats.correctDays,2);assert.equal(stats.lastDay,'2026-11-02');
  assert.equal(stats.status,'recalled');assert.equal(stats.needsPractice,false);assert.equal(stats.retained,true);
  assert.deepEqual(Array.from(stats.dates,d=>[d.day,d.correct,d.wrong]),[['2026-11-01',2,1],['2026-11-02',1,0]]);
  api.next();api.skip();
  assert.equal(api.stats().bySkill.grammar.retained,false);
  assert.ok(api.stats().weakSkills.includes('grammar'));
});
test('writing rejects incomplete or duplicated chunks without recording; full wrong order gets a worked sentence',()=>{
  const {api,journal}=visit();
  let q=api.startPractice('writing').question;
  assert.equal(api.answer([q.options[0]]).phase,'question');
  assert.equal(api.answer(q.options.map(()=>0)).feedback.kind,'empty');
  assert.equal(api.answer(q.options.map(()=>999)).feedback.kind,'empty');
  assert.equal(journal.length,0);
  const incorrect=solve(q).reverse();
  const tried=api.answer(incorrect);
  assert.equal(tried.feedback.kind,'wrong');
  assert.equal(tried.feedback.answerText,solution(q));
  q=api.next().question;
  assert.equal(api.answer(solve(q).map(c=>q.options.indexOf(c))).feedback.correct,true);
});
test('corrupt, incompatible and unavailable local storage do not break play or other modules',()=>{
  for(const data of ['broken','null','{"version":25}','{"version":1,"runs":{"practice:grammar":{"serial":1,"ids":null}},"log":[null]}']){
    const storage=new Map([[storageKey,data],['wallet','{"coins":15}']]);
    const {api}=visit(storage);
    assert.equal(api.getState().phase,'idle');
    assert.equal(api.startPractice('spelling').phase,'question');
    assert.equal(storage.get('wallet'),'{"coins":15}');
  }
  const {api}=visit(new Map(),{date:1},{readOnly:true});
  let q=api.startPractice('spelling').question;
  assert.equal(api.answer(solve(q)).storageAvailable,false);
  q=api.next().question;
  assert.equal(api.answer(solve(q)).summary.correct,2);
});

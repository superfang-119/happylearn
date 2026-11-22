const test = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {openGame}=require('./game-fixture.cjs');
const source=file=>fs.readFileSync(path.join(__dirname,'../dist',file),'utf8');
function visit(storage=new Map(),date=8,journal){
  const instant=new Date(2026,9,date,12).getTime();
  class Clock extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
  const legacy=openGame(storage,Clock),events=[];
  const context={Date:Clock,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    window:{LEARNING_CONTENT:{subjects:legacy.subjects,missions:legacy.missions},Game:legacy.game,LearnJournal:journal,
      dispatchEvent(event){events.push(event);}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(source('learn-facts.js'),context);
  vm.runInNewContext(source('learn-round.js'),context);
  const round=context.window.LearnRound,facts=context.window.LearnFacts;
  const actual=()=>{
    const {question}=round.getState(),m=legacy.missions.find(m=>m.id===question.id);
    return [m.recall,facts[m.id].practice].find(item=>item.prompt===question.prompt);
  };
  const solve=()=>round.answer(actual().answer);
  const wrong=()=>round.answer((actual().answer+1)%3);
  return {round,game:legacy.game,events,facts,actual,solve,wrong,storage};
}
function finish(s) {
  let state=s.round.getState();
  for(let i=0;i<18&&state.phase!=='complete';i++){
    if(state.phase==='question')s.solve();
    state=s.round.next();
  }
  assert.equal(state.phase,'complete');return state;
}

test('fresh English route lists eighteen ordered topics and the other routes have six and prevents skipping any gate',()=>{
  const s=visit(),p=s.round.getTopicProgress(),e=p.bySubject.english;
  assert.equal(p.total,36);assert.equal(p.passed.length,0);
  for(const [subject,route] of Object.entries(p.bySubject)){assert.equal(route.length,subject==="english"?18:6);assert.equal(route[0].status,'current');assert.ok(route.slice(1).every(t=>t.status==='locked'));}
  assert.equal(s.round.getState().subject,'english');assert.equal(s.round.getState().question.title,s.facts[e[0].id].topic);
  assert.equal(s.round.openTopic(e[1].id).ok,false);
  const done=finish(s);assert.deepEqual([done.baseDone,done.roundXp,done.roundCoins],[3,45,30]);
  assert.deepEqual(Array.from(s.round.getTopicProgress().passed),Array.from(e.slice(0,3),t=>t.id));
  assert.equal(s.events.filter(e=>e.type==='learn-topic-progress').length,3);
  assert.equal(s.round.nextRound().question.id,e[3].id);
});

test('helped answers require a changed prompt and a clean retrieval before unlocking; reload and switching cannot bypass it',()=>{
  const storage=new Map(),a=visit(storage),id=a.round.getState().question.id,base=a.actual().prompt;
  assert.equal(a.wrong().correct,false);
  assert.equal(a.solve().rewarded,true);assert.equal(a.round.getTopicProgress().passed.length,0);
  const b=visit(storage);assert.equal(b.round.getState().phase,'feedback');
  assert.equal(b.round.openTopic(id).ok,true);b.solve();assert.equal(b.round.getTopicProgress().passed.length,0);
  let r=b.round.next();assert.equal(r.mode,'review');assert.equal(r.question.clue,'');assert.notEqual(r.question.prompt,base);
  assert.equal(r.question.prompt,b.facts[id].practice.prompt);assert.equal(b.round.useInsight().ok,false);
  b.wrong();b.solve();assert.equal(b.round.getState().needsIndependent,true);
  assert.equal(b.round.getTopicProgress().passed.length,0);
  r=b.round.next();assert.equal(r.mode,'review');assert.equal(r.question.showHint,false);
  assert.equal(b.solve().passedNow,true);r=b.round.next();assert.equal(r.phase,'complete');
  assert.equal(r.recovered,1);assert.equal(b.game.getState().xp,15);assert.equal(b.game.getState().coins,10);
  const c=visit(storage);assert.equal(c.round.getTopicProgress().bySubject.english[1].status,'current');
  const one=c.round.nextRound();assert.equal(one.topicId,c.round.getTopicProgress().bySubject.english[1].id);
});

test('scope checkpoints survive reload and mixed rounds rotate three subjects across all four',()=>{
  const storage=new Map(),a=visit(storage);
  a.round.selectSubject('geography');a.wrong();
  const mix=a.round.selectSubject('all');
  assert.equal(mix.roundSize,3);
  const subjects1=new Set(mix.summary.map(x=>x.subject));assert.equal(subjects1.size,3);
  const b=visit(storage);assert.equal(b.round.getState().subject,'all');
  assert.equal(b.round.selectSubject('geography').question.wrong.length,1);
  b.round.selectSubject('all');finish(b);
  const second=b.round.nextRound(),subjects2=new Set(second.summary.map(x=>x.subject));
  assert.equal(subjects2.size,3);assert.equal(new Set([...subjects1,...subjects2]).size,4);
});

test('new daily prompts settle once in the shared wallet, purchased insight applies at most once and queues recovery',()=>{
  const storage=new Map(),s=visit(storage);
  s.solve();s.round.next();
  const second=s.round.getState().question.id;
  assert.equal(s.game.buyItem('insight').ok,true);
  const used=s.round.useInsight();
  assert.ok(used.ok);assert.notEqual(used.eliminated,s.actual().answer);
  assert.equal(s.round.answer(used.eliminated).ok,false);assert.equal(s.game.getState().inventory.insight,0);
  const b=visit(storage);assert.equal(b.round.getState().question.eliminated,used.eliminated);
  assert.equal(b.solve().rewarded,true);assert.equal(b.round.next().mode,'review');
  b.solve();b.round.next();assert.ok(b.round.getTopicProgress().passed.includes(second));
  assert.equal(b.game.getState().xp,30);assert.equal(b.game.getState().coins,12);
  b.round.openTopic(second);assert.equal(b.solve().rewarded,false);
});

test('all thirty-six gates can be earned and re-studied without duplicate badges or same-day XP',()=>{
  const storage=new Map(),s=visit(storage);
  for(const topic of s.round.getTopicProgress().topics){
    assert.ok(s.round.openTopic(topic.id).ok);assert.equal(s.solve().passedNow,true);s.round.next();
  }
  assert.equal(s.round.getTopicProgress().passed.length,36);assert.equal(s.game.getState().coins,360);
  const b=visit(storage),first=b.round.getTopicProgress().topics[0];
  b.round.openTopic(first.id);assert.equal(b.solve().passedNow,false);assert.equal(b.game.getState().xp,540);
  assert.equal(b.events.length,0);
});

test('next-day due knowledge is available for spaced practice while unseen topics stay in order',()=>{
  const storage=new Map(),a=visit(storage);
  a.wrong();a.solve();a.round.next();a.solve();a.round.next();finish(a);
  const b=visit(storage,9),old=b.round.getTopicProgress().bySubject.english[0];
  assert.ok(b.round.getState().dueCount>=1);assert.ok(b.round.getState().weakCount>=1);
  const next=b.round.nextRound();assert.ok(next.ids.includes(old.id));
  assert.equal(next.question.id,b.round.getTopicProgress().bySubject.english[3].id);
});

test('blocked storage still allows a complete round and corrupt local round state recovers',()=>{
  const blocked={get(){throw Error('disabled');},set(){throw Error('disabled');}};
  assert.equal(finish(visit(blocked)).baseDone,3);
  const stale=new Map([['happylearn.learning.rounds.v1','invalid JSON']]);
  assert.equal(visit(stale).round.getState().subject,'english');
});

test('interrupted reward receipt is reconciled after reload and does not grant the shared wallet twice',()=>{
  const backend=new Map();
  let interrupt=true;
  const storage={
    get:k=>backend.get(k),
    set(k,val){
      if(interrupt&&k==='happylearn.learning.rounds.v1'&&JSON.parse(val).rounds.english?.phase==='feedback'){
        interrupt=false;throw Error('interrupted write');
      }
      backend.set(k,val);
    }
  };
  const first=visit(storage);first.solve();
  assert.equal(first.game.getState().coins,10);
  const back=visit(backend),r=back.round.getState();
  assert.equal(r.phase,'feedback');assert.equal(r.roundCoins,10);
  assert.equal(back.game.getState().coins,10);assert.equal(back.round.getTopicProgress().passed.length,1);
});

test('switching back to English resumes the focused English challenge across a reload',()=>{
  const storage=new Map(),s=visit(storage);
  const first=s.round.getTopicProgress().bySubject.english[0];
  s.round.openTopic(first.id);s.wrong();
  s.round.selectSubject('history');
  const b=visit(storage);
  assert.equal(b.round.getState().subject,'history');
  const resumed=b.round.selectSubject('english');
  assert.equal(resumed.topicId,first.id);
  assert.equal(resumed.question.wrong.length,1);
});

const firstEnglish='en-name';
const mastery=(visit,id=firstEnglish)=>visit.round.getMasteryRows().find(row=>row.id===id);

test('mastery report is pure and distinguishes opening one question from unlocking, passing or studying the others',()=>{
  const storage=new Map(),s=visit(storage);
  const rows=s.round.getMasteryRows();
  assert.equal(rows.length,36);assert.equal(new Set(rows.map(r=>r.id)).size,36);
  assert.ok(rows.every(r=>r.status==='unseen'&&r.lastDate===null&&r.dueDate===null&&r.evidence));
  assert.equal(rows.filter(r=>r.available).length,4);assert.equal(storage.size,0);
  s.round.getState();
  assert.equal(mastery(s).status,'learning');assert.equal(mastery(s).lastDate,null);
  assert.equal(mastery(s,'en-colour').status,'unseen');assert.equal(mastery(s,'en-colour').available,false);
  const before=JSON.stringify([...storage]);s.round.getMasteryRows();s.round.getMasteryRows();
  assert.equal(JSON.stringify([...storage]),before);assert.equal(s.game.getState().coins,0);
});

test('only clean answers on two distinct local calendar dates establish retained, with weak and due evidence taking precedence',()=>{
  const storage=new Map(),first=visit(storage,8);
  first.round.openTopic(firstEnglish);first.solve();first.round.next();
  assert.equal(mastery(first).status,'independent');assert.equal(mastery(first).lastDate,'2026-10-08');
  assert.equal(mastery(first).dueDate,'2026-10-09');
  first.round.openTopic(firstEnglish);first.solve();first.round.next();assert.equal(mastery(first).status,'independent');
  const next=visit(storage,9);
  assert.equal(mastery(next).status,'review');
  next.round.openTopic(firstEnglish);next.solve();next.round.next();
  assert.equal(mastery(next).status,'retained');
  assert.match(mastery(next).evidence,/2026-10-08.*2026-10-09/);
  assert.equal(mastery(visit(storage,12)).status,'review');

  const lapse=visit(storage,10);
  lapse.round.openTopic(firstEnglish);lapse.wrong();
  assert.equal(mastery(lapse).status,'review');assert.equal(mastery(lapse).lastDate,'2026-10-10');
  lapse.solve();lapse.round.next();lapse.round.hint();lapse.solve();lapse.round.next();
  assert.equal(mastery(lapse).status,'review');
  lapse.solve();lapse.round.next();
  assert.equal(mastery(lapse).status,'review');
  const again=visit(storage,11);
  again.round.openTopic(firstEnglish);again.solve();again.round.next();
  assert.match(mastery(again).evidence,/2026-10-10.*2026-10-11/);
});

test('old passes, badges, review levels and malformed dates never manufacture retained evidence',()=>{
  const storage=new Map();
  storage.set('happylearn.learning.rounds.v1',JSON.stringify({
    passed:['en-name','en-colour','en-under'],
    memory:{
      'en-name':{due:'2026-10-21',last:'2026-10-07',stage:3,sequence:2,weak:false},
      'en-colour':{due:'2026-10-21',last:'2026-10-07',stage:3,sequence:5,weak:true},
      'en-under':{due:'2026-10-21',last:'2026-10-08',stage:3,sequence:6,
        firstIndependent:'2026-02-30',recalledOn:'2026-10-07'}
    }
  }));
  const old=visit(storage,8),before=JSON.stringify([...storage]);
  assert.equal(mastery(old).status,'independent');assert.equal(mastery(old,'en-colour').status,'review');
  assert.equal(mastery(old,'en-under').status,'independent');assert.equal(JSON.stringify([...storage]),before);
  old.round.openTopic(firstEnglish);old.solve();old.round.next();
  assert.equal(mastery(old).status,'independent');
  const after=visit(storage,9);after.round.openTopic(firstEnglish);after.solve();after.round.next();
  assert.equal(mastery(after).status,'retained');
});

test('reading a pending overnight payment does not replay it, and settling it records only the actual answering day',()=>{
  const backend=new Map();let crash=true;
  const storage={
    get:k=>backend.get(k),
    set(k,v){
      if(crash&&k==='happylearn.learning.rounds.v1'&&JSON.parse(v).rounds.english?.phase==='feedback'){
        crash=false;throw Error('interrupted');
      }
      backend.set(k,v);
    }
  };
  const yesterday=visit(storage,8);yesterday.solve();
  const log=[],today=visit(backend,9,{record:entry=>log.push(entry)}),before=JSON.stringify([...backend]);
  assert.equal(mastery(today).status,'learning');assert.equal(JSON.stringify([...backend]),before);
  today.round.getState();assert.equal(today.game.getState().coins,10);
  const r=mastery(today);assert.equal(r.lastDate,'2026-10-08');assert.equal(r.status,'independent');assert.equal(log.length,0);
});

test('journal receives true submissions and assistance with topic-specific explanations, but no reads or rejected input',()=>{
  const log=[],s=visit(new Map(),8,{record:entry=>log.push(entry)});
  s.round.openTopic(firstEnglish);s.round.getMasteryRows();s.round.answer(-1);
  assert.equal(log.length,0);
  s.wrong();s.round.hint();s.solve();s.round.next();
  const practice=s.actual();
  s.solve();s.round.next();s.round.getMasteryRows();
  assert.deepEqual(log.map(e=>e.outcome),['wrong','assisted','correct']);
  assert.ok(log.every(e=>e.source==='topic'&&e.id===firstEnglish&&e.subject==='english'&&e.title===s.facts[firstEnglish].topic&&e.note));
  assert.equal(log[2].note,practice.explain);assert.match(log[0].example,/My name is/);
  const second=s.round.getTopicProgress().bySubject.english[1].id;
  s.round.openTopic(second);s.round.hint();assert.equal(log.at(-1).outcome,'assisted');

  const t=visit(new Map(),8,{record(){throw Error('journal unavailable');}});
  assert.ok(t.solve().correct);assert.equal(t.game.getState().coins,10);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {openGame}=require('./game-fixture.cjs');

function visit(storage=new Map()){
  const lesson=openGame(storage),nodes=new Map(),handlers=new Map(),events=[];
  function element(){
    const children=new Map(),listeners=new Map();
    return {dataset:{},innerHTML:'',hidden:false,isConnected:true,setAttribute(){},focus(){},contains:()=>false,
      addEventListener:(k,fn)=>listeners.set(k,fn),click(button){listeners.get('click')?.({target:{closest:()=>button}});},
      querySelector(q){if(!children.has(q))children.set(q,element());return children.get(q);},querySelectorAll:()=>[],
      showModal(){this.open=true;},close(){this.open=false;listeners.get('close')?.();}};
  }
  for(const id of ['learn-home','learn-trail-inline','learn-medals'])nodes.set(id,element());
  const document={getElementById:id=>nodes.get(id),querySelector:()=>null,createElement:element,body:{append:e=>nodes.set(e.id,e)}};
  const window={LEARNING_CONTENT:lesson,Game:lesson.game,setTimeout(){this.toasts++;return 1;},clearTimeout(){},toasts:0,
    addEventListener:(name,fn)=>handlers.set(name,fn),dispatchEvent(e){events.push(e);handlers.get(e.type)?.(e);}};
  const ctx={window,document,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  for(const file of ['learn-facts.js','learn-round.js','learn-trail.js']){
    const source=fs.readFileSync(path.join(__dirname,'../dist',file),'utf8');vm.runInNewContext(source,ctx);
  }
  const round=window.LearnRound,trail=window.LearnTrail;
  function pass(id){
    assert.ok(round.openTopic(id).ok);
    const question=round.getState().question;
    const mission=lesson.missions.find(m=>m.id===id);
    const answer=[mission.recall,window.LearnFacts[id].practice].find(m=>m.prompt===question.prompt).answer;
    assert.equal(round.answer(answer).correct,true);round.next();
  }
  return {window,round,trail,nodes,events,pass,storage};
}

test('inline syllabus follows the current subject, named gates and real learning actions',()=>{
  const s=visit(),el=s.nodes.get('learn-trail-inline');
  s.trail.mountInline(el,'english');
  assert.match(el.innerHTML,/英语闯关清单/);
  assert.equal((el.innerHTML.match(/data-lt-topic=/g)||[]).length,6);
  assert.equal((el.innerHTML.match(/disabled /g)||[]).length,5);
  const id=s.round.getTopicProgress().bySubject.english[0].id;
  assert.match(el.innerHTML,new RegExp(s.window.LearnFacts[id].topic));
  const button={dataset:{ltTopic:id},hasAttribute:k=>k==='data-lt-topic'};
  el.contains=target=>target===button;el.click(button);
  assert.equal(s.events.at(-1).type,'learn-trail-topic');assert.equal(s.events.at(-1).detail.state.question.id,id);
  s.pass(id);assert.equal(s.trail.snapshot().bySubject.english.passed,1);
  assert.match(el.innerHTML,/已通过/);
  s.trail.mountInline(el,'history');assert.match(el.innerHTML,/历史闯关清单/);
  assert.doesNotMatch(el.innerHTML,/<select/);
});

test('English stages preview six consecutive gates and follow the next available topic',()=>{
  const s=visit(), el=s.nodes.get('learn-trail-inline'), entries=s.round.getTopicProgress().bySubject.english;
  assert.equal(entries.length,18);
  const click=(key,index)=>{
    const attr=key==='stage'?'data-lt-stage':'data-lt-current';
    const button={dataset:{ltStage:String(index)},hasAttribute:name=>name===attr};
    el.contains=value=>value===button;el.click(button);
  };
  s.trail.mountInline(el,'english');
  for(const title of ['生活表达','句子基础','校园日常'])assert.match(el.innerHTML,new RegExp(title));
  assert.match(el.innerHTML,/data-lt-stage="0" aria-pressed="true"/);
  click('stage',2);
  assert.match(el.innerHTML,/data-lt-stage="2" aria-pressed="true"/);
  assert.equal((el.innerHTML.match(/disabled /g)||[]).length,6);
  assert.ok(el.innerHTML.includes('data-lt-topic="'+entries[17].id+'"'));
  assert.ok(!el.innerHTML.includes('data-lt-topic="'+entries[0].id+'"'));
  assert.equal(s.round.openTopic(entries[17].id).ok,false);
  click('current');
  assert.match(el.innerHTML,/data-lt-stage="0" aria-pressed="true"/);
  for(const m of entries.slice(0,6))s.pass(m.id);
  s.trail.mountInline(el,'english');assert.match(el.innerHTML,/data-lt-stage="1" aria-pressed="true"/);
  assert.ok(el.innerHTML.includes('data-lt-topic="'+entries[6].id+'"'));
  click('stage',0);
  assert.equal((el.innerHTML.match(/class="lt-row lt-passed"/g)||[]).length,6);
  s.trail.mountInline(el,'chinese');
  assert.doesNotMatch(el.innerHTML,/data-lt-stage=/);
  assert.equal((el.innerHTML.match(/data-lt-topic=/g)||[]).length,6);
});

test('eight medals are earned from unique passes and replay or reload does not announce them twice',()=>{
  const s=visit(),plan=s.round.getTopicProgress();
  s.trail.openMedals();
  const dialog=s.nodes.get('learn-medals');
  assert.match(dialog.innerHTML,/0 \/ 8/);assert.equal(s.trail.snapshot().totalPassed,0);
  const first=plan.bySubject.english[0].id;s.pass(first);assert.equal(s.window.toasts,1);
  s.pass(first);assert.equal(s.window.toasts,1);
  for(const subject of ['geography','history','chinese'])s.pass(plan.bySubject[subject][0].id);
  assert.match(dialog.innerHTML,/2 \/ 8/);
  for(const route of Object.values(plan.bySubject))for(const entry of route.slice(1,6))s.pass(entry.id);
  const oldMilestones=visit(s.storage);oldMilestones.trail.openMedals();
  assert.match(oldMilestones.nodes.get('learn-medals').innerHTML,/7 \/ 8/);
  assert.equal(oldMilestones.trail.snapshot().bySubject.english.foundationPassed,6);
  for(const entry of plan.bySubject.english.slice(6))s.pass(entry.id);
  const state=s.trail.snapshot();assert.equal(state.totalPassed,36);assert.equal(new Set(state.passedIds).size,36);
  assert.equal(state.bySubject.english.total,18);assert.ok(Object.values(state.bySubject).every(v=>v.passed===v.total&&v.foundationPassed===6));
  assert.match(dialog.innerHTML,/8 \/ 8/);assert.equal((dialog.innerHTML.match(/class="lm-card lm-earned"/g)||[]).length,8);
  const notifications=s.events.filter(e=>e.type==='learn-trail-change');assert.equal(notifications.length,36);
  assert.equal(notifications.at(-1).detail.totalPassed,36);
  const reopened=visit(s.storage);reopened.trail.openMedals();reopened.pass(first);
  assert.equal(reopened.window.toasts,0);assert.equal(reopened.trail.snapshot().totalPassed,36);
});

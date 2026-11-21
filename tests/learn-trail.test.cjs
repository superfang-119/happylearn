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

test('seven medals are earned from unique passes and replay or reload does not announce them twice',()=>{
  const s=visit(),plan=s.round.getTopicProgress();
  s.trail.openMedals();
  const dialog=s.nodes.get('learn-medals');
  assert.match(dialog.innerHTML,/0 \/ 7/);assert.equal(s.trail.snapshot().totalPassed,0);
  const first=plan.bySubject.english[0].id;s.pass(first);assert.equal(s.window.toasts,1);
  s.pass(first);assert.equal(s.window.toasts,1);
  for(const subject of ['geography','history','chinese'])s.pass(plan.bySubject[subject][0].id);
  assert.match(dialog.innerHTML,/2 \/ 7/);
  for(const route of Object.values(plan.bySubject))for(const entry of route.slice(1))s.pass(entry.id);
  const state=s.trail.snapshot();assert.equal(state.totalPassed,24);assert.equal(new Set(state.passedIds).size,24);
  assert.ok(Object.values(state.bySubject).every(v=>v.passed===6&&v.total===6));
  assert.match(dialog.innerHTML,/7 \/ 7/);assert.equal((dialog.innerHTML.match(/class="lm-card lm-earned"/g)||[]).length,7);
  const notifications=s.events.filter(e=>e.type==='learn-trail-change');assert.equal(notifications.length,24);
  assert.equal(notifications.at(-1).detail.totalPassed,24);
  const reopened=visit(s.storage);reopened.trail.openMedals();reopened.pass(first);
  assert.equal(reopened.window.toasts,0);assert.equal(reopened.trail.snapshot().totalPassed,24);
});

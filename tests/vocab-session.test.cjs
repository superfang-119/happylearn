const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const sessionKey='happylearn.vocabulary.practice.v1';
function visit(storage=new Map(),date=1){
  let instant=new Date(2026,8,date,12).getTime();
  class Clock extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
  const dialog={classList:{add(){}},setAttribute(){},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null};
  const ctx={Date:Clock,window:{addEventListener(){}},document:{getElementById:()=>dialog},localStorage:{
    getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)
  }};
  for(const file of ['vocab-data.js','content.js','game.js','vocab-session.js']){
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),ctx);
  }
  const p=ctx.window.WordPractice;
  function solveRound(){
    let s=p.start();let safety=0;
    while(s.phase!=='complete'&&safety++<25){
      if(s.phase==='quiz')s=p.answer(s.word.word);
      else s=p.next();
    }
    assert.equal(s.phase,'complete');return s;
  }
  return {p,ctx,game:ctx.window.Game,storage,solveRound,date(d){instant=new Date(2026,8,d,12).getTime();}};
}

test('new words are introduced, recalled after different cards, and resumed independently for both stages',()=>{
  const s=visit(),p=s.p;
  assert.equal(p.getState().phase,'idle');
  const initial=p.start(),names=Array.from(initial.roundWords,w=>w.word);
  assert.equal(initial.phase,'study');assert.equal(new Set(names).size,3);
  assert.equal(p.stats('primary').practiced,0);
  assert.equal(p.next().word.word,names[1]);p.selectStage('junior');
  const restored=visit(s.storage).p;
  assert.equal(restored.getState().stage,'junior');assert.equal(restored.getState().phase,'study');
  let st=restored.selectStage('primary');assert.equal(st.word.word,names[1]);
  st=restored.next();assert.equal(st.word.word,names[2]);
  st=restored.next();assert.equal(st.phase,'quiz');assert.equal(st.word.word,names[0]);
  assert.equal(restored.answer(' ').phase,'quiz');
  st=restored.answer('  '+names[0].toUpperCase()+'  ');
  assert.equal(st.feedback.kind,'correct');assert.equal(st.feedback.xpGain,3);
  assert.equal(st.roundCoins,2);assert.equal(st.completed,1);
  assert.equal(restored.answer(names[0]).roundCoins,2);
  assert.equal(s.game.getState().coins,2);
  assert.equal(restored.wordStatus(names[0],'primary'),'practiced');
  assert.equal(restored.stats('junior').practiced,0);
});

test('wrong guesses, spelling hints and reveals require an independent attempt after a different word',()=>{
  const {p,game,storage}=visit();p.start();p.next();p.next();
  let s=p.next();const a=s.word.word;
  assert.equal(p.answer('wrong guess').feedback.kind,'wrong');assert.equal(game.getState().coins,0);
  s=p.next();const b=s.word.word;assert.notEqual(a,b);
  assert.equal(p.hint().assisted,true);
  const again=visit(storage).p;assert.equal(again.getState().assisted,true);
  assert.equal(again.answer(b).feedback.kind,'assisted');assert.equal(game.getState().coins,0);
  s=p.next();const c=s.word.word;assert.notEqual(b,c);
  assert.equal(p.reveal().feedback.answer,c);assert.equal(p.stats('primary').due,3);
  for(const id of [a,b]){
    assert.equal(p.next().word.word,id);assert.equal(p.answer(id).feedback.xpGain,3);
  }
  assert.equal(p.next().word.word,c);p.reveal();
  s=p.next();assert.equal(s.isBridge,true);assert.notEqual(s.word.word,c);
  assert.equal(p.answer(s.word.word).feedback.coinGain,0);
  s=p.next();assert.equal(s.word.word,c);assert.equal(s.assisted,false);
  assert.equal(p.answer(c).feedback.coinGain,2);
  assert.equal(p.next().phase,'complete');assert.equal(game.getState().coins,6);assert.equal(p.stats('primary').due,0);
});

test('local-date review intervals progress through 1, 3, 7 and 14 days and due words are tested first',()=>{
  const s=visit(),p=s.p,original=s.solveRound();const ids=Array.from(original.roundWords,w=>w.word);
  for(const [due,after] of [[2,5],[5,12],[12,26],[26,40]]){
    s.date(due);assert.equal(p.stats('primary').due,3);
    const run=p.start();assert.equal(run.phase,'quiz');assert.deepEqual(Array.from(run.roundWords,w=>w.word),ids);
    assert.equal(s.solveRound().roundCoins,6);
    s.date(after-1);assert.equal(p.stats('primary').due,0);
  }
  s.date(40);assert.equal(p.stats('primary').due,3);
});

test('same-day replays and reloading a paid reward intent cannot double-pay a word',()=>{
  const s=visit(),p=s.p,initial=p.start();p.next();p.next();p.next();
  const wallet=s.game;
  s.ctx.window.Game={...wallet,rewardVocabulary(word,answer){
    wallet.rewardVocabulary(word,answer);throw new Error('browser interrupted');
  }};
  assert.throws(()=>p.answer(initial.word.word),/interrupted/);
  let resumed=visit(s.storage);
  const recovered=resumed.p.getState();assert.equal(recovered.phase,'feedback');assert.equal(recovered.completed,1);
  assert.equal(recovered.roundXp,3);assert.equal(recovered.roundCoins,2);assert.equal(resumed.game.getState().coins,2);
  resumed.solveRound();let repeat=resumed.p.focusWord(initial.word.word);
  assert.equal(repeat.word.word,initial.word.word);assert.equal(repeat.phase,'study');
  repeat=resumed.p.next();assert.notEqual(repeat.word.word,initial.word.word);
  while(repeat.phase!=='quiz'||repeat.word.word!==initial.word.word){
    repeat=repeat.phase==='quiz'?resumed.p.answer(repeat.word.word):resumed.p.next();
  }
  assert.equal(resumed.p.answer(repeat.word.word).feedback.coinGain,0);
  assert.equal(resumed.game.getState().coins,6);
});

test('a focused word starts its own small group without erasing a suspended standard round',()=>{
  const s=visit(),p=s.p,old=p.start();p.next();
  const w=s.ctx.window.EnglishWords.filter(w=>w.stage==='primary').at(-1);
  let focus=p.focusWord(w.word,'primary');assert.equal(focus.word.word,w.word);assert.equal(focus.phase,'study');
  s.solveRound();const back=visit(s.storage).p.start();
  assert.deepEqual(Array.from(back.roundWords,w=>w.word),Array.from(old.roundWords,w=>w.word));
  assert.equal(back.word.word,old.roundWords[1].word);
});

test('malformed vocabulary data recovers without touching the shared wallet',()=>{
  const store=new Map([[sessionKey,'{}']]),s=visit(store);
  assert.equal(s.p.start().roundSize,3);s.solveRound();
  const coins=s.game.getState().coins;store.set(sessionKey,'{"stage":');
  const restored=visit(store);assert.equal(restored.p.getState().phase,'idle');assert.equal(restored.game.getState().coins,coins);
});

test('selecting science already in a group opens its exact study card immediately and interleaves its recall',()=>{
  const s=visit(),p=s.p,initial=p.selectStage('junior');
  assert.ok(initial.roundWords.some(w=>w.word==='science'));
  assert.notEqual(initial.word.word,'science');
  let card=p.focusWord('science','junior');
  assert.equal(card.phase,'study');assert.equal(card.word.word,'science');
  assert.deepEqual(Array.from(card.roundWords,w=>w.word),Array.from(initial.roundWords,w=>w.word));
  assert.equal(visit(s.storage).p.getState().word.word,'science');
  card=p.next();assert.notEqual(card.word.word,'science');
  if(card.phase==='quiz')p.answer(card.word.word);
  card=p.next();assert.equal(card.word.word,'science');assert.equal(card.phase,'quiz');
  assert.equal(p.answer('science').feedback.coinGain,2);
});

test('accepted spelling variants pass, while a valid synonym receives meaning feedback and a fresh target recall',()=>{
  const s=visit(),p=s.p;
  function quiz(target){
    let st=p.getState();
    for(let i=0;i<25;i++){
      if(st.phase==='quiz'&&st.word.word===target)return st;
      st=st.phase==='quiz'?p.answer(st.word.word):p.next();
    }
    assert.fail('No quiz for '+target);
  }
  p.focusWord('close','primary');quiz('close');
  const before=s.game.getState().coins;
  let st=p.answer('shut');assert.equal(st.feedback.kind,'wrong');assert.equal(st.feedback.reason,'alternative');
  assert.match(st.feedback.message,/意思也对/);assert.equal(st.feedback.answer,null);
  assert.equal(s.game.getState().coins,before);assert.equal(st.completed,0);
  st=p.next();assert.notEqual(st.word.word,'close');quiz('close');
  assert.equal(p.answer('close').feedback.coinGain,2);
  for(const [word,spell] of [['maths','math'],['practice','practise']]){
    p.focusWord(word,'junior');quiz(word);
    assert.equal(p.answer(spell).feedback.kind,'correct');
  }
  assert.ok(s.game.getState().vocabularyClaimedToday.includes('practice'));
});

test('mastery rows distinguish viewing a card, assisted attempts, errors, independent spelling and later recall',()=>{
  const s=visit(),p=s.p;
  const rows=()=>p.getMasteryRows();
  const row=id=>rows().find(entry=>entry.id===id);
  const initial=rows();
  assert.equal(initial.length,120);assert.equal(initial.filter(r=>r.stage==='primary').length,60);
  assert.ok(initial.every(r=>r.status==='unseen'&&r.available&&r.subject==='english'&&r.lastDate===null));
  assert.equal(s.storage.size,0);
  p.start();
  assert.equal(row('book').status,'learning');assert.equal(row('book').lastDate,'2026-09-01');
  assert.equal(p.stats('primary').practiced,0);
  p.next();p.next();p.next();
  p.answer('incorrect');
  assert.equal(row('book').status,'review');assert.equal(row('book').dueDate,null);
  p.next();p.hint();
  assert.equal(row('bag').status,'learning');assert.match(row('bag').evidence,/提示/);
  p.answer('bag');p.next();p.reveal();
  assert.equal(row('pen').status,'learning');
  p.next();p.answer('book');
  assert.equal(row('book').status,'independent');assert.equal(row('book').dueDate,'2026-09-02');
  s.solveRound();
  s.date(2);assert.equal(row('book').status,'review');
  s.solveRound();assert.equal(row('book').status,'retained');assert.equal(row('book').lastDate,'2026-09-02');
  assert.equal(row('book').dueDate,'2026-09-05');
  const fresh=visit(s.storage,2);
  assert.equal(fresh.p.getMasteryRows().find(r=>r.id==='book').status,'retained');
  s.date(5);assert.equal(row('book').status,'review');
  p.start();p.answer('incorrect');p.next();p.answer('bag');p.next();p.answer('pen');p.next();p.answer('book');
  assert.equal(row('book').status,'independent');
});

test('mastery report is read-only with interrupted wallet payment and offers no active quiz or answer metadata',()=>{
  const s=visit(),p=s.p,initial=p.start();
  p.next();p.next();p.next();
  const wallet=s.game;
  s.ctx.window.Game={...wallet,rewardVocabulary(){throw new Error('between saves');}};
  assert.throws(()=>p.answer(initial.word.word),/between saves/);
  const before=Array.from(s.storage);
  const restored=visit(s.storage);
  restored.ctx.window.Game={getState(){throw new Error('read should not touch wallet');},
    rewardVocabulary(){throw new Error('read should not pay wallet');}};
  const rows=restored.p.getMasteryRows();
  assert.deepEqual(Array.from(s.storage),before);
  assert.equal(rows.find(r=>r.id===initial.word.word).status,'independent');
  const keys='available,dueDate,evidence,id,lastDate,stage,status,subject,title,word,zh';
  assert.ok(rows.every(r=>Object.keys(r).sort().join(',')===keys));
  rows[0].status='changed';assert.notEqual(restored.p.getMasteryRows()[0].status,'changed');
});

test('legacy mastery rows infer retained only from an actual advanced independent schedule',()=>{
  const old={stage:'primary',courses:{primary:{records:{
    book:{level:2,lastDay:'2026-09-01',due:'2026-09-04',errors:2},
    pen:{weak:true,errors:1},
    ruler:{weak:true,errors:0},
    bag:{lastDay:'2026-02-31',due:'2026-02-31',level:4},
    desk:{level:1,lastDay:'2026-09-01',due:'2026-09-02'},
    chair:{weak:true,lastDay:'2026-09-01',level:1}
  }}}};
  const save=JSON.stringify(old),storage=new Map([[sessionKey,save]]),{p}=visit(storage);
  const byId=new Map(Array.from(p.getMasteryRows(),r=>[r.id,r]));
  assert.equal(byId.get('book').status,'retained');assert.equal(byId.get('pen').status,'review');
  assert.equal(byId.get('ruler').status,'learning');assert.equal(byId.get('ruler').lastDate,null);
  assert.equal(byId.get('pen').lastDate,null);assert.equal(byId.get('bag').status,'learning');
  assert.equal(byId.get('bag').lastDate,null);assert.equal(byId.get('desk').status,'independent');
  assert.equal(byId.get('chair').status,'review');assert.equal(storage.get(sessionKey),save);
});

test('journal records committed word actions, never passive reads or assisted work as independent spelling',()=>{
  const {p,ctx}=visit(),entries=[];
  ctx.window.LearnJournal={record(entry){entries.push(entry);}};
  p.getMasteryRows();p.start();p.getState();p.getMasteryRows();
  assert.equal(entries.length,0);
  p.next();p.next();p.next();
  assert.deepEqual(entries.map(x=>x.outcome),['studied','studied','studied']);
  assert.equal(entries[0].id,'book');assert.match(entries[0].example,/book/);
  p.answer('');p.getMasteryRows();assert.equal(entries.length,3);
  p.answer('wrong');p.next();p.hint();p.answer('bag');p.next();p.reveal();
  assert.deepEqual(entries.slice(3).map(x=>x.outcome),['wrong','assisted','assisted']);
  p.next();p.answer('book');p.answer('book');
  assert.equal(entries.length,7);assert.equal(entries.at(-1).outcome,'correct');
  assert.ok(entries.every(x=>x.source==='word'&&x.subject==='english'&&x.note));
});

test('reports can mask pending recall words across stages without modifying progress',()=>{
  const s=visit(),p=s.p;
  assert.deepEqual(Array.from(p.getPendingRecallWords()),[]);
  p.start();p.next();p.next();p.next();
  p.selectStage('junior');p.next();p.next();p.next();
  const raw=s.storage.get(sessionKey);
  assert.deepEqual(Array.from(p.getPendingRecallWords()),['book','subject']);
  assert.equal(s.storage.get(sessionKey),raw);
  p.hint();assert.ok(p.getPendingRecallWords().includes('subject'));
  p.reveal();assert.deepEqual(Array.from(p.getPendingRecallWords()),['book']);
});

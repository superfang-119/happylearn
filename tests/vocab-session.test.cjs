const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const sessionKey='happylearn.vocabulary.practice.v1';
function visit(storage=new Map(),date=1,guided=false){
  let instant=new Date(2026,8,date,12).getTime();
  class Clock extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
  const dialog={classList:{add(){}},setAttribute(){},addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null};
  const ctx={Date:Clock,window:{addEventListener(){}},document:{getElementById:()=>dialog},localStorage:{
    getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)
  }};
  const phonics=guided?['vocab-ipa.js','phonics-drill.js']:[];
  for(const file of ['vocab-data.js',...phonics,'content.js','game.js','vocab-session.js']){
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

function advanceGuided(v, state) {
  const {p, ctx} = v;
  const word = state.word.word;
  if (state.phase === 'listen') return p.pickPhonics(ctx.window.PhonicsDrill.vowelFor(word));
  if (state.phase === 'blend') {
    const part = ctx.window.VocabIPA[word].parts[state.drill.cursor];
    if (part) return p.pickPhonics(part[0]);
  }
  return state.phase === 'quiz' ? p.answer(word) : p.next();
}
function until(v, predicate) {
  let state = v.p.getState();
  for (let i = 0; i < 100; i++) {
    if (predicate(state)) return state;
    assert.notEqual(state.phase, 'complete', 'round ended before the requested exercise');
    state = advanceGuided(v, state);
  }
  assert.fail('guided round did not advance');
}

test('every added word reaches listening, blending, independent spelling and an interleaved transfer through the word bank', () => {
  const words = visit(new Map(),1,true).ctx.window.EnglishWords.filter(w => w.scene);
  assert.equal(words.length,30);
  for (const w of words) {
    const v = visit(new Map(),1,true), {p} = v;
    const model = p.focusWord(w.word, w.stage);
    assert.equal(model.roundSize,3);
    assert.equal(model.phase,'study');
    let state = p.next();
    assert.equal(state.phase,'listen',w.word);
    assert.equal(p.answer(w.word).phase,'listen');
    assert.equal(p.next().phase,'listen');
    const vowel = v.ctx.window.PhonicsDrill.vowelFor(w.word);
    const wrong = state.drill.options.find(s => s !== vowel);
    assert.equal(p.pickPhonics(wrong).feedback.kind,'retry');
    state = p.pickPhonics(vowel);
    assert.equal(state.phase,'blend');
    for (const [i,[letters]] of v.ctx.window.VocabIPA[w.word].parts.entries()) {
      const decoy = state.drill.tiles.find(tile => tile !== letters);
      assert.equal(p.pickPhonics(decoy).drill.cursor,i);
      assert.equal(p.answer(w.word).drill.cursor,i);
      state = p.pickPhonics(letters);
      assert.equal(state.drill.cursor,i+1);
    }
    assert.equal(state.roundCoins,0);
    assert.notEqual(p.next().word.word,w.word);
    const spell = until(v,s => s.word.word === w.word && s.phase === 'quiz');
    assert.equal(spell.quizMode,'spell');
    let result = p.answer(w.word);
    assert.equal(result.feedback.kind,'spelled');
    assert.equal(result.feedback.coinGain,0);
    assert.equal(result.completed,0);
    assert.notEqual(p.next().word.word,w.word);
    const transfer = until(v,s => s.word.word === w.word && s.phase === 'quiz');
    assert.equal(transfer.quizMode,'context');
    assert.equal(transfer.prompt,w.scene.prompt);
    assert.notEqual(transfer.prompt,w.example);
    result = p.answer(w.word);
    assert.equal(result.feedback.coinGain,2);
    assert.equal(result.feedback.xpGain,3);
    assert.equal(p.answer(w.word).roundCoins,result.roundCoins);
    const complete = until(v,s => s.phase === 'complete');
    assert.equal(complete.roundCoins,6);
    assert.equal(complete.roundXp,9);
  }
});

test('refresh and stage switches retain the exact listening choices and blending cursor; bad data restarts only the drill', () => {
  let v = visit(new Map(),1,true);
  v.p.focusWord('sister','primary');
  const listening = v.p.next();
  const options = Array.from(listening.drill.options);
  v = visit(v.storage,1,true);
  assert.deepEqual(Array.from(v.p.getState().drill.options),options);
  v.p.pickPhonics('ɪ');v.p.pickPhonics('s');v.p.pickPhonics('i');
  const before = v.p.getState().drill;
  v.p.selectStage('junior');
  v = visit(v.storage,1,true);
  const back = v.p.selectStage('primary');
  assert.equal(back.phase,'blend');assert.equal(back.drill.cursor,2);
  assert.deepEqual(Array.from(back.drill.tiles),Array.from(before.tiles));
  assert.equal(v.p.pickPhonics('s','sister',0).drill.cursor,2);
  assert.equal(v.p.pickPhonics('s').drill.cursor,3);
  const raw = JSON.parse(v.storage.get(sessionKey));
  raw.courses.primary.round.steps[0].drill.cursor = -100;
  v.storage.set(sessionKey,JSON.stringify(raw));
  assert.equal(v.p.getState().phase,'study');
  assert.equal(v.p.getState().word.word,'sister');
  assert.equal(v.p.getState().roundSize,3);
  assert.equal(v.p.next().phase,'listen');
});

test('spelling aids and misses defer the same task; transfer retries are free and preserve the 1/3/7/14-day schedule', () => {
  let v = visit(new Map(),1,true);
  v.p.focusWord('bike','primary');
  const target = mode => s => s.phase === 'quiz' && s.word.word === 'bike' && s.quizMode === mode;
  until(v,target('spell'));
  assert.equal(v.p.answer('bik').feedback.kind,'wrong');
  assert.notEqual(v.p.next().word.word,'bike');
  until(v,target('spell'));v.p.hint();
  assert.equal(v.p.answer('bike').feedback.kind,'assisted');
  assert.equal(v.game.getState().vocabularyClaimedToday.includes('bike'),false);
  assert.notEqual(v.p.next().word.word,'bike');
  until(v,target('spell'));
  assert.equal(v.p.answer('BIKE').feedback.kind,'spelled');
  v = visit(v.storage,1,true);
  assert.equal(v.p.getState().feedback.kind,'spelled');
  assert.notEqual(v.p.next().word.word,'bike');
  const first = until(v,target('context'));
  assert.equal(v.p.reveal().feedback.coinGain,0);
  assert.notEqual(v.p.next().word.word,'bike');
  assert.equal(until(v,target('context')).prompt,first.prompt);
  assert.equal(v.p.answer('bike').feedback.coinGain,2);
  assert.equal(until(v,s => s.phase === 'complete').roundCoins,6);
  let lastPrompt = first.prompt;
  for (const [today, nextDue] of [[2,5],[5,12],[12,26],[26,40]]) {
    v.date(today);
    assert.equal(v.p.stats('primary').due,3);
    assert.equal(v.p.start().phase,'quiz');
    const due = until(v,target('context'));
    assert.notEqual(due.prompt,lastPrompt);
    lastPrompt=due.prompt;
    assert.equal(v.p.answer('bike').feedback.coinGain,2);
    assert.equal(until(v,s => s.phase === 'complete').roundCoins,6);
    v.date(nextDue-1);
    assert.equal(v.p.stats('primary').due,0);
  }
});

test('a v1 in-flight context, wallet claim and an unaligned word work with the guided scripts loaded', () => {
  const old = visit();
  old.p.start();old.p.next();old.p.next();old.p.next();
  old.p.answer('book');
  const next = old.p.next();
  const v = visit(old.storage,1,true);
  assert.equal(v.p.getState().word.word,next.word.word);
  assert.equal(v.p.getState().quizMode,'context');
  assert.equal(v.p.getState().roundCoins,2);
  assert.equal(until(v,s => s.phase === 'complete').roundCoins,6);
  const entry = v.p.focusWord('science','junior');
  assert.equal(entry.word.word,'science');
  assert.notEqual(v.p.next().phase,'listen');
  const quiz = until(v,s => s.phase === 'quiz' && s.word.word === 'science');
  assert.equal(quiz.quizMode,'context');
  assert.equal(v.p.answer('science').feedback.coinGain,2);
});

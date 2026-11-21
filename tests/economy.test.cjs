const test = require('node:test');
const assert = require('node:assert/strict');
const {openGame} = require('./game-fixture.cjs');
const key='happylearn.islands.field.v1';

function visit(storage, day=7) {
  const time=new Date(2026,8,day,12).getTime();
  class Today extends Date {constructor(...args){super(...(args.length?args:[time]));}}
  return openGame(storage,Today);
}
const wrong=item=>(item.answer+1)%item.options.length;
function earnFromPhone(s,count) {
  const cards=s.missions.filter(m=>m.subject!=='mixed').slice(0,count);
  for(const m of cards)s.game.answerCityQuiz(m.id,m.recall.answer);
  return cards;
}

test('old completions retain XP and earn their coins once, including mixed expedition',()=>{
  const storage=new Map(), seed=visit(storage);
  const regular=seed.missions[0], mixed=seed.missions.find(m=>m.subject==='mixed');
  storage.set(key,JSON.stringify({completed:[regular.id,mixed.id,mixed.id,'unknown']}));
  const first=visit(storage);
  assert.equal(first.game.getState().xp,60);
  assert.equal(first.game.getState().coins,36);
  first.solve(regular);
  assert.equal(visit(storage).game.getState().coins,36);
  const next=first.missions[1];first.solve(next);
  assert.deepEqual([first.game.getState().xp,first.game.getState().coins,first.game.getState().level,first.game.getState().levelXP],[80,48,2,0]);
  assert.match(first.dialog.innerHTML,/金币 \+12/);
  assert.match(first.dialog.innerHTML,/升至 LV. 2/);
});

test('phone checks choice IDs and rewards one correct answer per card/local day, including cross-tab retries',()=>{
  const storage=new Map(),a=visit(storage),b=visit(storage),m=a.missions[0],mixed=a.missions.find(m=>m.subject==='mixed');
  assert.equal(a.game.answerCityQuiz(mixed.id,0).ok,false);
  for(const invalid of [-1,'0',true,3])assert.equal(a.game.answerCityQuiz(m.id,invalid).ok,false);
  const miss=a.game.answerCityQuiz(m.id,wrong(m.recall));
  assert.equal(miss.correct,false);assert.deepEqual(Array.from(b.game.getState().quizWrongToday[m.id]),[wrong(m.recall)]);
  const hit=b.game.answerCityQuiz(m.id,m.recall.answer);
  assert.deepEqual([hit.correct,hit.rewarded,hit.xpGain,hit.coinGain],[true,true,15,10]);
  assert.equal(a.game.answerCityQuiz(m.id,m.recall.answer).rewarded,false);
  assert.equal(a.game.getState().coins,10);
  const tomorrow=visit(storage,8);
  assert.deepEqual(Array.from(tomorrow.game.getState().quizClaimedToday),[]);
  assert.equal(tomorrow.game.answerCityQuiz(m.id,m.recall.answer).rewarded,true);
  assert.equal(tomorrow.game.getState().xp,30);
});

test('due review pays after getting help and retrying over reload, early/repeated practice is free of extra grants',()=>{
  const storage=new Map(),initial=visit(storage),m=initial.missions[0];
  initial.solve(m);
  initial.click('recall',m.id);initial.click('answer',m.recall.answer);
  assert.equal(initial.game.getState().xp,20);
  const due=visit(storage,8);
  due.click('recall',m.id);due.click('hint');due.click('answer',wrong(m.recall));
  assert.equal(due.game.getState().coins,12);
  const back=visit(storage,8);
  back.click('recall',m.id);back.click('answer',m.recall.answer);
  assert.match(back.dialog.innerHTML,/金币 \+5/);
  back.click('recall',m.id);back.click('answer',m.recall.answer);
  assert.deepEqual([back.game.getState().xp,back.game.getState().coins],[28,17]);
});

test('catalog purchases, equipment and insight deductions survive refresh and double taps',()=>{
  const storage=new Map(),s=visit(storage),{game}=s;
  assert.deepEqual(Array.from(game.catalog,i=>i.price),[8,32,48]);
  assert.equal(game.buyItem('paint').ok,false);
  assert.equal(game.equipItem('shoes',true).ok,false);
  earnFromPhone(s,10); // 100 coins and 150 XP.
  assert.equal(game.buyItem('shoes').coins,68);
  assert.equal(game.buyItem('shoes').coins,68);
  assert.equal(game.getState().equipped.shoes,true);
  game.equipItem('shoes',false);game.buyItem('paint');game.buyItem('insight');
  assert.equal(game.getState().coins,12);
  const b=visit(storage),m=b.missions[12],item=m.recall;
  assert.equal(b.game.getState().equipped.shoes,false);
  assert.equal(b.game.getState().equipped.paint,true);
  const wrongOptions=item.options.flatMap((_,i)=>i!==item.answer?[i]:[]);
  assert.equal(b.game.useQuizInsight(m.id,wrongOptions).ok,false);
  assert.equal(b.game.getState().inventory.insight,1);
  b.game.answerCityQuiz(m.id,wrongOptions[0]);
  const help=b.game.useQuizInsight(m.id);
  assert.equal(help.eliminated,wrongOptions[1]);assert.equal(b.game.getState().inventory.insight,0);
  assert.equal(b.game.useQuizInsight(m.id).eliminated,help.eliminated);
  const after=visit(storage);
  assert.equal(after.game.getState().quizEliminatedToday[m.id],help.eliminated);
  assert.equal(after.game.answerCityQuiz(m.id,help.eliminated).ok,false);
  assert.equal(after.game.answerCityQuiz(m.id,item.answer).coinGain,10);
});

test('legacy mission and recall share inventory, and each eliminated answer stays disabled across reload',()=>{
  const storage=new Map(),s=visit(storage),m=s.missions[0];
  earnFromPhone(s,3);
  s.game.buyItem('insight');s.game.buyItem('insight');s.game.start(m.subject,m.id);
  m.sites.forEach((_,i)=>s.click('inspect',i));s.click('to-choice');s.click('insight');
  const eliminated=m.options.findIndex((_,i)=>i!==m.answer);
  s.click('answer',eliminated);assert.equal(s.game.getState().mistakes[m.id],undefined);
  const b=visit(storage);b.game.start(m.subject,m.id);
  assert.match(b.dialog.innerHTML,new RegExp('data-value="'+eliminated+'" class="gm-answer gm-missed" disabled'));
  b.click('answer',m.answer);b.click('recall',m.id);b.click('insight');b.click('insight');
  assert.equal(b.game.getState().inventory.insight,0);
  b.click('answer',m.recall.answer);
  assert.equal(b.game.getState().coins,26);
});

test('corrupt economy fields and disabled storage cannot break learning or create spendable funds',()=>{
  const storage=new Map([[key, JSON.stringify({wallet:{quizzes:{nope:['__proto__']},bought:1e12,owned:['paint'],equipped:{paint:true},used:{bad:0}}})]]);
  const corrupt=visit(storage).game;
  assert.deepEqual([corrupt.getState().coins,corrupt.getState().inventory.insight,corrupt.getState().owned.length],[0,0,0]);
  const blocked={get(){throw Error('blocked');},set(){throw Error('blocked');}};
  const s=visit(blocked),m=s.missions[0];
  assert.ok(s.game.answerCityQuiz(m.id,m.recall.answer).rewarded);assert.equal(s.game.buyItem('insight').coins,2);
  assert.equal(s.game.getState().inventory.insight,1);
});

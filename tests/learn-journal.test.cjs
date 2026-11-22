const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../dist/learn-journal.js'), 'utf8');
const storageKey = 'happylearn.daily-lessons.v1';

function openJournal({ data = new Map(), start = '2026-11-21T15:55:00Z', storage } = {}) {
  let instant = Date.parse(start);
  let writes = 0;
  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  function localPart(when,type) {
    return Number(dateParts.formatToParts(when).find(part => part.type === type).value);
  }
  class LocalClock extends Date {
    constructor(...args) {
      // Numeric components, like new Date(y,m,d,12), denote Shanghai wall time.
      // Avoid using the test host's own time zone to construct that local noon.
      super(args.length>1 ? Date.UTC(...args)-8*60*60*1000 : args.length?args[0]:instant);
    }
    getFullYear() { return localPart(this,'year'); }
    getMonth() { return localPart(this,'month') - 1; }
    getDate() { return localPart(this,'day'); }
  }
  const dialog = {
    open:false, innerHTML:'', addEventListener() {}, querySelector() { return null; },
    showModal() { this.open=true; }
  };
  const sandbox = {
    Date:LocalClock, window:{ addEventListener() {} },
    document:{ getElementById() { return dialog; }, activeElement:null },
    localStorage:storage || { getItem:key=>data.get(key)??null, setItem(key,value){writes++;data.set(key,value);} }
  };
  vm.runInNewContext(source, sandbox);
  return {
    api:sandbox.window.LearnJournal,dialog,data,writes:()=>writes,
    at(iso){instant=Date.parse(iso);}
  };
}

function item(changes={}) {
  return {source:'topic',subject:'english',id:'en-name',title:'用英语介绍名字',
    outcome:'correct',note:'My name is 放在名字前面。',example:'My name is Leo.　我叫利奥。',...changes};
}

test('reading days, lessons and the empty dialog neither records activity nor writes local storage',()=>{
  const {api,writes,dialog,data}=openJournal();
  assert.deepEqual(Array.from(api.days()),['2026-11-21']); // Today is only an empty navigation choice.
  assert.equal(api.lessons().length,0);
  assert.equal(api.lessons('2026-11-17').length,0);
  api.open(null,'2026-11-17');
  assert.match(dialog.innerHTML,/还没有学习记录/);
  assert.equal(data.size,0);assert.equal(writes(),0);
  assert.equal(api.record(item({title:'  '})),false);
  assert.equal(writes(),0);
});

test('local midnight separates entries for the same point even while both timestamps fall on the same UTC day',()=>{
  const {api,at,data}=openJournal({start:'2026-11-21T15:59:59Z'});
  api.record(item({outcome:'wrong',note:'昨天把名字词认错了。'}));
  at('2026-11-21T16:00:01Z');
  api.record(item({note:'今天独立答对了。'}));
  assert.deepEqual(Array.from(api.days()),['2026-11-22','2026-11-21']);
  assert.equal(api.lessons('2026-11-21')[0].hadHelp,true);
  assert.equal(api.lessons('2026-11-22')[0].hadHelp,false);
  const back=openJournal({data,start:'2026-11-21T17:30:00Z'});
  assert.equal(back.api.lessons()[0].note,'今天独立答对了。');
  assert.equal(back.api.lessons('2026-11-21')[0].note,'昨天把名字词认错了。');
});

test('latest explanation replaces the previous one but past mistakes, hints or skips survive later success and reload',()=>{
  for (const initial of ['wrong','assisted','skipped']) {
    const {api,data}=openJournal();
    api.record(item({outcome:initial,note:'早先的讲解'}));
    api.record(item({outcome:'assisted',note:'又使用一次提示'}));
    api.record(item({outcome:'wrong',note:'仍需帮助'}));
    assert.equal(api.lessons().length,1,'successive assisted attempts represent one daily topic');
    api.record(item({id:'other', title:'读懂颜色词'}));
    api.record(item({outcome:'correct',note:'订正后的讲解',example:'My name is May.　我叫梅。'}));
    api.record(item({outcome:'correct',note:'最后一次的讲解'}));
    const list=openJournal({data}).api.lessons();
    assert.equal(list.length,2);assert.equal(list[0].id,'en-name');
    assert.equal(list[0].outcome,'correct');assert.equal(list[0].hadHelp,true);
    assert.equal(list[0].note,'最后一次的讲解');assert.equal(list[1].hadHelp,false);
    list[0].note='外部改写';assert.equal(api.lessons()[0].note,'最后一次的讲解');
  }
});

test('subjects and activity sources namespace an ID, including records made by another open tab',()=>{
  const a=openJournal(),b=openJournal({data:a.data});
  a.api.record(item({id:'1'}));
  b.api.record(item({id:'1',subject:'history',outcome:'wrong'}));
  a.api.record(item({id:'1',source:'word',outcome:'studied'}));
  b.api.record(item({id:'1',source:'exam'}));
  a.api.record(item({id:'1',source:'check'}));
  const list=a.api.lessons();
  const keys=Array.from(list,e=>e.source+'/'+e.subject+'/'+e.id);
  assert.deepEqual(keys,['check/english/1','exam/english/1','word/english/1','topic/history/1','topic/english/1']);
  assert.equal(list.filter(e=>e.hadHelp).length,1);
  assert.equal(list.find(e=>e.subject==='history').outcome,'wrong');
});

test('broken JSON and invalid rows can be read safely and later valid activity still saves',()=>{
  for (const damaged of ['not JSON','null','false','[]','42','"string"']) {
    const data=new Map([[storageKey,damaged]]),s=openJournal({data});
    assert.equal(s.api.lessons().length,0);assert.equal(data.get(storageKey),damaged);
    assert.ok(s.api.record(item()));assert.equal(s.api.lessons().length,1);
  }
  const raw={ '2026-11-20':[null,{},item({source:'unknown'}),item({outcome:'unknown'}),item({id:''}),item({subject:'chinese',id:'cn-1'})], other:[item()] };
  const s=openJournal({data:new Map([[storageKey,JSON.stringify(raw)]])});
  assert.deepEqual(Array.from(s.api.days()),['2026-11-21','2026-11-20']);
  assert.equal(s.api.lessons('2026-11-20').length,1);
  assert.equal(s.writes(),0);
});

test('damaged duplicate rows merge their help evidence and imaginary dates are excluded without repairing on read',()=>{
  const date='2026-11-18';
  const raw={
    [date]:[item({note:'最新的正确讲解'}),item({outcome:'wrong',note:'较早的错误讲解'})],
    '2026-02-30':[item()],
    '2025-02-29':[item()],
    '2024-02-29':[item()]
  };
  const s=openJournal({data:new Map([[storageKey,JSON.stringify(raw)]])});
  assert.deepEqual(Array.from(s.api.days()),['2026-11-21',date,'2024-02-29']);
  const list=s.api.lessons(date);
  assert.equal(list.length,1);assert.equal(list[0].note,'最新的正确讲解');assert.equal(list[0].hadHelp,true);
  assert.equal(s.api.lessons('not-a-date').length,0);assert.equal(s.api.lessons('toString').length,0);
  assert.equal(s.writes(),0);
});

test('unavailable reads and a quota failure on write keep the current session usable',()=>{
  const disabled=openJournal({storage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}}});
  assert.equal(disabled.api.lessons().length,0);
  disabled.api.record(item({outcome:'assisted'}));disabled.api.record(item());
  assert.equal(disabled.api.lessons()[0].hadHelp,true);
  disabled.api.open();assert.match(disabled.dialog.innerHTML,/本次打开期间/);
  const prior=JSON.stringify({'2026-11-20':[item({id:'old'})]});
  const limited=openJournal({storage:{getItem(){return prior;},setItem(){throw Error('quota');}}});
  assert.ok(limited.api.record(item({id:'new'})));
  assert.equal(limited.api.lessons('2026-11-20')[0].id,'old');
  assert.equal(limited.api.lessons()[0].id,'new');
  limited.api.record(item({id:'next'}));assert.equal(limited.api.lessons().length,2);
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'../dist/wardrobe.js'), 'utf8');
const subjectIds = ['english','geography','history','chinese'];
const key = 'happylearn.learning.outfit.v1';

function setup(counts = [0,0,0,0], storage = new Map(), useTrail = true) {
  const handlers = new Map(), dialogEvents = new Map(), notices = [];
  const live = {};
  const document = {activeElement:null, getElementById:() => dialog};
  function node(dataset = {}) {
    const item = {dataset, isConnected:true, focus:() => {document.activeElement = item;},
      hasAttribute(attr) { return Object.hasOwn(dataset, attr.slice(5).replace(/-([a-z])/g,(_,c) => c.toUpperCase())); },
      closest() { return item; }};
    return item;
  }
  const dialog = {open:false, innerHTML:'', addEventListener:(name,fn) => dialogEvents.set(name,fn),
    showModal(){ this.open=true; }, close(){ this.open=false; dialogEvents.get('close')(); },
    querySelector(selector) { return selector === '.wd-live' ? live : node({outfit:selector.match(/data-outfit="([^"]+)"/)?.[1]}); }};
  class CustomEvent { constructor(type, info) { Object.assign(this, {type}, info); } }
  const window = {addEventListener:(name,fn) => handlers.set(name,fn),
    dispatchEvent:event => notices.push(event), localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  function rows(id, count) {
    return Array.from({length:id==='english'?18:6}, (_, i) => ({id:id+i,status:i<count?'passed':'locked'}));
  }
  window.LearnRound = {getTopicProgress:() => {
    const bySubject = Object.fromEntries(subjectIds.map((id,i)=>[id,rows(id,counts[i])]));
    return {passed:Object.values(bySubject).flat().filter(v=>v.status==='passed').map(v=>v.id),bySubject};
  }};
  if (useTrail) window.LearnTrail = {snapshot:() => ({
    passedIds:window.LearnRound.getTopicProgress().passed,
    bySubject:Object.fromEntries(subjectIds.map((id,i)=>[id,{passed:counts[i],total:id==='english'?18:6,foundationPassed:Math.min(counts[i],6)}]))
  })};
  vm.runInNewContext(source,{window,document,CustomEvent});
  const click = data => dialogEvents.get('click')({target:node(data)});
  return {api:window.LearnWardrobe,window,notices,dialog,click,live,handlers,document,node};
}

test('locked previews show learning milestones and cannot equip; wearing or removing persists', () => {
  const counts = [0,0,0,0], storage = new Map(), s = setup(counts,storage);
  const opener = s.node();
  s.api.open(opener);s.click({outfit:'courier'});
  assert.match(s.dialog.innerHTML,/晨光信使全身造型/);
  assert.match(s.dialog.innerHTML,/再通过 1 个学习关卡/);
  s.click({wear:'courier'});
  assert.equal(s.api.avatar().id,'pathfinder');
  counts[0] = 1;s.handlers.get('learn-trail-change')();
  s.click({wear:'courier'});
  assert.equal(s.api.avatar().id,'courier');
  assert.equal(s.notices.at(-1).detail.coat,'#e87841');
  assert.equal(setup(counts,storage).api.avatar().id,'courier');
  s.click({wear:'pathfinder'});assert.equal(storage.get(key),'pathfinder');
  s.dialog.close();assert.equal(s.document.activeElement,opener);
});

test('established progress unlocks the exact two advanced outfits independently, also before trail mounts', () => {
  for (const useTrail of [true,false]) {
    const all = setup([1,1,1,1],new Map(),useTrail);
    all.api.open();all.click({wear:'starpilot'});assert.equal(all.api.avatar().id,'pathfinder');
    all.click({wear:'leafcloak'});assert.equal(all.api.avatar().id,'leafcloak');
    const one = setup([0,0,6,0],new Map(),useTrail);
    one.api.open();one.click({wear:'leafcloak'});assert.equal(one.api.avatar().id,'pathfinder');
    one.click({wear:'starpilot'});assert.equal(one.api.avatar().id,'starpilot');
  }
});

test('unknown or unearned saved looks fall back; storage events and blocked writes remain safe', () => {
  const counts=[1,0,0,0], s=setup(counts,new Map([[key,'leafcloak']]));
  assert.equal(s.api.avatar().id,'pathfinder');
  s.handlers.get('storage')({key,newValue:'courier'});
  assert.equal(s.api.avatar().id,'courier');
  s.handlers.get('storage')({key,newValue:'unknown'});assert.equal(s.api.avatar().id,'pathfinder');
  s.window.localStorage.setItem=()=>{throw Error('blocked');};
  s.api.open();s.click({wear:'courier'});assert.equal(s.api.avatar().id,'courier');
  assert.match(s.live.textContent,/本次打开期间/);
});

test('an outfit unlocked by the original six English gates stays equipped after the English course expands to 18',()=>{
  for(const useTrail of [true,false]){
    const store=new Map([[key,'starpilot']]);
    const locked=setup([5,0,0,0],store,useTrail);
    locked.api.open();locked.click({outfit:'starpilot'});
    assert.equal(locked.api.avatar().id,'pathfinder');
    assert.match(locked.dialog.innerHTML,/基础关还差 1 关/);
    const preserved=setup([6,0,0,0],store,useTrail);
    assert.equal(preserved.api.avatar().id,'starpilot');
    preserved.api.open();preserved.click({outfit:'starpilot'});
    assert.match(preserved.dialog.innerHTML,/英语的前 6 个基础关/);
  }
});

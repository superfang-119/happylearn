const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'../dist/voice.js'),'utf8');
const model = 'My name is Bo.';

function setup(voices = [], supported = true) {
  const spoken = [], observers = [];
  let canceled = 0;
  class Element {
    constructor() {
      this.attrs = new Map();this.listeners = new Map();this.children = [];
      this.isConnected = true;this.textContent = '';this.open = false;this.hidden = false;
    }
    append(...items) {this.children.push(...items);}
    contains(item) {return this.children.includes(item);}
    replaceChildren() {for (const el of this.children) el.isConnected = false;this.children = [];this.textContent = '';}
    setAttribute(name,v) {this.attrs.set(name,v);}
    addEventListener(name,handler) {this.listeners.set(name,handler);}
    closest() {return null;}
    querySelector() {return null;}
    click() {this.listeners.get('click')?.();}
    remove() {this.isConnected = false;}
  }
  class MutationObserver {
    constructor(callback) {this.callback = callback;}
    observe(target,options) {observers.push({callback:this.callback,target,options});}
  }
  const doc = new Element(),home = new Element(),island = new Element(),wardrobe = new Element(),container = new Element();
  const vocab = new Element();
  const dialogs = [island,wardrobe,vocab];
  doc.getElementById = id => id === 'learn-home' ? home : id === 'game-dialog' ? island : id === 'vocab-dialog' ? vocab : null;
  doc.createElement = () => new Element();
  doc.querySelectorAll = selector => selector === 'dialog' ? dialogs : dialogs.filter(d=>d.open);
  const state = {mode:'learn',phase:'question',question:{id:'en-name',subject:'english',clue:'用英语介绍自己。'}};
  const window = new Element();
  window.dispatchEvent = () => {};
  window.LearnRound = {getState:() => state};
  window.LearnFacts = {'en-name':{model:{en:model,zh:'我叫博。'}}};
  if (supported) {
    window.SpeechSynthesisUtterance = class {constructor(text){this.text = text;}};
    window.speechSynthesis = {getVoices:()=>voices,speak:u=>spoken.push(u),cancel:()=>{canceled++;}};
  }
  vm.runInNewContext(source,{window,document:doc,MutationObserver,Event});
  const changed = (target,attr) => observers.filter(w=>w.target===target && w.options.attributeFilter?.includes(attr))
    .forEach(w=>w.callback([{target}]));
  const mount = () => window.LearnVoice.mountModel(container,'en-name');
  return {window,doc,home,island,wardrobe,vocab,container,state,spoken,changed,mount,Element,canceled:()=>canceled};
}

test('model reads only after an explicit click; toggling and utterance end restore the accessible button', () => {
  const local = {lang:'en-GB',localService:true};
  const s = setup([{lang:'zh-CN'}, {lang:'en-US',localService:false}, local]);
  s.mount();const btn = s.container.children[0];
  assert.equal(s.spoken.length,0);
  assert.equal(btn.attrs.get('aria-pressed'),'false');
  btn.click();
  assert.equal(s.spoken[0].text,model);assert.equal(s.spoken[0].voice,local);
  assert.equal(btn.textContent,'停止朗读');assert.equal(btn.attrs.get('aria-pressed'),'true');
  const ended = s.spoken[0].onend;
  btn.click();assert.equal(s.canceled(),1);assert.equal(btn.textContent,'听示范');
  btn.click();ended();assert.equal(btn.attrs.get('aria-pressed'),'true');
  s.spoken[1].onend();assert.equal(btn.attrs.get('aria-pressed'),'false');
});

test('stale buttons and independent recall have no playable model, and another open dialog stops current speech', () => {
  const s = setup();s.mount();const button = s.container.children[0];
  s.state.mode = 'review';button.click();s.mount();
  assert.equal(s.spoken.length,0);assert.equal(s.container.children.length,0);
  s.state.mode = 'learn';s.mount();s.container.children[0].click();assert.equal(s.spoken.length,1);
  s.wardrobe.open=true;s.changed(s.wardrobe,'open');
  assert.equal(s.canceled(),1);s.container.children[0].click();assert.equal(s.spoken.length,1);
  s.wardrobe.open=false;s.state.question.id='en-other';s.container.children[0].click();assert.equal(s.spoken.length,1);
  s.state.question.id='en-name';s.state.question.subject='history';s.mount();assert.equal(s.container.children.length,0);
  s.state.question.subject='english';s.mount();s.container.children[0].click();s.home.hidden=true;s.changed(s.home,'hidden');
  assert.equal(s.canceled(),2);
});

test('island controls read only English already visible in the discovered passage', () => {
  const s = setup(), passage = new s.Element();let strip = null;
  s.island.open=true;passage.textContent='她说“My name is Bo.”，意思是“我叫博”。';
  passage.after = el => {strip=el;};
  s.island.querySelector = selector => selector.includes('forest') ? {} : passage;
  s.changed(s.island,'open');assert.equal(s.spoken.length,0);
  strip.children[0].click();assert.equal(s.spoken[0].text,model);
  s.island.open=false;s.changed(s.island,'open');assert.equal(s.canceled(),1);
});

test('missing API, missing English voices, and speech failures keep a usable written fallback', () => {
  const no = setup([],false);
  no.mount();assert.equal(no.container.children.length,0);assert.match(no.container.textContent,/跟读/);
  const cn = setup([{lang:'zh-CN'}]);cn.mount();cn.container.children[0].click();
  assert.equal(cn.spoken.length,0);assert.match(cn.container.children[1].textContent,/继续阅读/);
  const denied = setup();denied.mount();denied.container.children[0].click();
  denied.spoken[0].onerror({error:'not-allowed'});
  assert.equal(denied.container.children[0].attrs.get('aria-pressed'),'false');
  assert.match(denied.container.children[1].textContent,/继续阅读/);
});

test('word and example audio work only on the current word card in study or revealed feedback', () => {
  const s = setup();
  const state = {phase:'study', word:{word:'map',example:'This is a map.'}, feedback:null};
  s.window.WordPractice = {getState:() => state};
  const example = new s.Element();
  const wordButton = () => s.window.LearnVoice.mountWord(s.container,'map','word');
  const exampleButton = () => s.window.LearnVoice.mountWord(example,'map','example');
  wordButton();exampleButton();
  s.container.children[0].click();assert.equal(s.spoken.length,0);
  s.vocab.open=true;s.changed(s.vocab,'open');
  s.container.children[0].click();example.children[0].click();
  assert.deepEqual(s.spoken.map(utterance=>utterance.text),['map','This is a map.']);
  s.vocab.open=false;s.changed(s.vocab,'open');assert.equal(s.canceled(),2);
  s.vocab.open=true;state.phase='quiz';
  example.children[0].click();assert.equal(s.spoken.length,2);
  for (const kind of ['wrong','empty']) {
    state.phase='feedback';state.feedback={kind};
    example.children[0]?.click();wordButton();assert.equal(s.container.children.length,0);
    assert.equal(s.spoken.length,2);
  }
  for (const kind of ['correct','revealed','assisted']) {
    state.feedback={kind};wordButton();s.container.children[0].click();
    assert.equal(s.spoken.at(-1).text,'map');s.window.LearnVoice.stop();
  }
  const last=s.container.children[0], count=s.spoken.length;
  state.word={word:'bag',example:'This is a bag.'};
  last.click();assert.equal(s.spoken.length,count);
  wordButton();assert.equal(s.container.children.length,0);
});

test('a word uses packaged recording without speech services; cancelled playback cannot start a stale TTS fallback', async () => {
  for (const supported of [false,true]) {
    const s=setup([],supported), recordings=[],state={phase:'study',word:{word:'map',example:'This is a map.'}};
    s.vocab.open=true;s.window.WordPractice={getState:()=>state};
    let pending;
    s.window.WordAudio={has:id=>id==='map',play:id=>{recordings.push(id);return new Promise(r=>{pending=r;});},
      stop:()=>{pending?.(false);pending=null;}};
    s.window.LearnVoice.mountWord(s.container,'map','word');const b=s.container.children[0];
    b.click();assert.deepEqual(recordings,['map']);assert.equal(s.spoken.length,0);
    pending(true);await new Promise(done=>setImmediate(done));assert.equal(b.attrs.get('aria-pressed'),'false');
    b.click();s.window.LearnVoice.stop();state.phase='quiz';await new Promise(done=>setImmediate(done));
    assert.equal(s.spoken.length,0);
    if (supported) {
      state.phase='study';b.click();pending(false);await new Promise(done=>setImmediate(done));
      assert.equal(s.spoken.length,1);assert.equal(s.spoken[0].text,'map');
    }
  }
});

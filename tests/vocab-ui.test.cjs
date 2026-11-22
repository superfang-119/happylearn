const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {openGame} = require('./game-fixture.cjs');

function lesson() {
  const listeners = {}, status = {}, input = {}, events = {}, played = [];
  const body = {querySelectorAll: () => [], querySelector: sel => ({
    '[data-drill-status]': status, '#vw-answer': input
  })[sel]};
  const dialog = {open:false, contains: () => true, setAttribute() {}, querySelectorAll: () => [],
    querySelector: sel => ({'.vw-body':body, '.vw-scroll':{}, '#vw-live':{}, '.vw-library':{setAttribute() {}}})[sel],
    addEventListener: (name, cb) => {listeners[name] = cb;},
    showModal() {this.open = true;}, close() {this.open = false; listeners.close();}
  };
  const document = {getElementById: () => dialog, addEventListener: (name, cb) => {events[name] = cb;}};
  const storage = new Map();
  let resolve;
  function play(value) {
    played.push(value);
    return new Promise(done => {resolve = done;});
  }
  const window = {Game:openGame().game, addEventListener() {}, dispatchEvent() {},
    WordAudio:{play, playSound:play, stop() {resolve?.(false); resolve = null;}}};
  const ctx = {window, document, CustomEvent:class {}, localStorage:{
    getItem:k => storage.get(k) || null, setItem:(k,v) => storage.set(k,v)
  }};
  for (const file of ['vocab-data','vocab-ipa','phonics-drill','vocab-session','vocab-ui']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist', file+'.js'),'utf8'), ctx);
  }
  function click(key, value) {
    const b = {dataset:{[key]:value}, hasAttribute:attr => attr === 'data-'+key.replace(/[A-Z]/g,c => '-'+c.toLowerCase())};
    listeners.click({target:{closest: () => b}});
  }
  const practice = window.WordPractice;
  practice.focusWord('bike');
  window.WordPracticeUI.open();
  return {window,body,dialog,status,events,document,played,click,practice,finish:ok => resolve?.(ok)};
}
const tick = () => new Promise(r => setImmediate(r));

test('the UI replays the current word and isolated sounds, offers text on audio failure and stops late sequence playback on close', async () => {
  const s = lesson();
  s.click('wordAct','next');
  assert.doesNotMatch(s.body.innerHTML,/\bbike\b/i);
  assert.deepEqual(s.played,['bike']);
  s.click('drillAudio','sample-0');
  assert.equal(s.played.at(-1),s.practice.getState().drill.options[0]);
  s.finish(false);await tick();
  assert.match(s.status.textContent,/口形或字母提示/);
  s.click('drillPick','eɪ');assert.match(s.status.textContent,/再比较/);
  for(const value of ['aɪ','b','i','k'])s.click('drillPick',value);
  assert.doesNotMatch(s.body.innerHTML,/data-drill-audio="part"/);
  s.click('drillPick','e');
  assert.equal(s.played.at(-1),'bike');
  s.click('drillAudio','sequence');assert.equal(s.played.at(-1),'b');
  s.finish(true);await tick();assert.equal(s.played.at(-1),'aɪ');
  // A successful audio callback is queued just before the dialog closes.
  s.finish(true);s.click('wordAct','close');await tick();
  assert.equal(s.played.at(-1),'aɪ');
});

test('real spelling and context forms have no model, target or sound controls and use different cues', () => {
  const s = lesson(), p = s.practice;
  let state = p.getState();
  const modes = [];
  for(let i=0;i<100 && state.phase!=='complete';i++) {
    const w = state.word.word;
    if(state.phase==='listen')state=p.pickPhonics(s.window.PhonicsDrill.vowelFor(w));
    else if(state.phase==='blend' && s.window.VocabIPA[w].parts[state.drill.cursor]) {
      state=p.pickPhonics(s.window.VocabIPA[w].parts[state.drill.cursor][0]);
    }else if(state.phase==='quiz'){
      if(w==='bike'){
        s.window.WordPracticeUI.open();
        const html=s.body.innerHTML;
        modes.push(state.quizMode);
        assert.doesNotMatch(html,/\bbike\b|baɪk|data-word-phonics|data-drill-audio|data-vw-say/i);
        assert.match(html,/写|拼/);
        if(state.quizMode==='spell')assert.doesNotMatch(html,/vw-blank|chain/);
        else assert.match(html,/The chain on my .*vw-blank/);
      }
      state=p.answer(w);
    }else state=p.next();
  }
  assert.deepEqual(modes,['spell','context']);
  assert.equal(state.phase,'complete');
});

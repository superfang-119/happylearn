const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'../dist',name),'utf8');

function open() {
  const played=[],sounds=[],events={},listeners={},live={textContent:''};
  const dialog={open:true,addEventListener(k,v){listeners[k]=v;}};
  const document={hidden:false,getElementById:()=>dialog,addEventListener(k,v){events[k]=v;}};
  const host={isConnected:true,innerHTML:'',replaceChildren(){this.innerHTML='';},
    contains:b=>!!b,querySelector:q=>q==='.ph-live'?live:{focus(){}}};
  const state={phase:'study',word:{word:'book'},feedback:null};
  let stops=0, pending;
  const window={addEventListener(k,v){events[k]=v;},WordPractice:{getState:()=>state},
    WordAudio:{has:()=>true,hasSound:()=>true,playSound(ipa){sounds.push(ipa);return Promise.resolve(true);},play(word){played.push(word);return new Promise(r=>{pending=r;});},
      stop(){stops++;pending?.(false);pending=null;}}};
  const MutationObserver=class{observe(){}};
  vm.runInNewContext(source('vocab-ipa.js'),{window});
  vm.runInNewContext(source('phonics.js'),{window,document,MutationObserver});
  const click=action=>host.onclick?.({target:{closest:()=>({dataset:{ph:action},disabled:false})}});
  return {window,host,state,click,played,sounds,dialog,live,stopCount:()=>stops,events,listeners};
}

test('full IPA is visible on study; beginner can inspect actual letter–sound pairs before taking an audio quiz',()=>{
  const s=open();s.window.Phonics.mount(s.host,'book');
  assert.match(s.host.innerHTML,/\/bʊk\//);assert.doesNotMatch(s.host.innerHTML,/data-ph="demo-/);
  s.click('toggle');assert.match(s.host.innerHTML,/data-ph="part-2"/);
  s.click('part-0');assert.match(s.host.innerHTML,/闭上双唇/);
  s.click('part-1');assert.match(s.host.innerHTML,/收圆/);s.click('part-sound');assert.deepEqual(s.sounds,['ʊ']);
  s.click('part-2');assert.match(s.host.innerHTML,/舌后部/);
  s.click('start');assert.deepEqual(s.played,[]);
  s.click('demo-0');assert.deepEqual(s.sounds,['ʊ','æ']);assert.deepEqual(s.played,[]);
  s.click('demo-sound');assert.equal(s.sounds.at(-1),'æ');s.click('example');assert.deepEqual(s.played,['bag']);
  s.click('start');assert.equal(s.played.length,2);
  const answer={bag:0,map:0,pen:1,bed:1,fish:2,milk:2,book:3}[s.played[1]];
  assert.ok(Number.isInteger(answer));assert.match(s.host.innerHTML,/你听到哪个元音/);
  const wrong=[...s.host.innerHTML.matchAll(/data-ph="answer-(\d)"/g)].map(m=>Number(m[1])).find(i=>i!==answer);
  s.click('answer-'+wrong);assert.match(s.host.innerHTML,/再听听/);
  s.click('answer-'+answer);assert.match(s.host.innerHTML,/听对了/);
});

test('quiz, wrong answers, stale cards and a closed dialog do not reveal IPA or play a clue',()=>{
  const s=open();s.window.Phonics.mount(s.host,'book');s.click('toggle');s.click('demo-1');s.click('example');
  s.state.phase='quiz';s.click('demo-0');assert.deepEqual(s.played,['pen']);assert.ok(s.stopCount()>0);
  s.window.Phonics.mount(s.host,'book');assert.equal(s.host.innerHTML,'');
  s.state.phase='feedback';s.state.feedback={kind:'wrong'};s.window.Phonics.mount(s.host,'book');
  assert.equal(s.host.innerHTML,'');s.state.feedback={kind:'assisted'};s.window.Phonics.mount(s.host,'book');
  assert.match(s.host.innerHTML,/bʊk/);s.state.word={word:'bag'};s.click('toggle');
  assert.doesNotMatch(s.host.innerHTML,/data-ph="demo-/);
  s.window.Phonics.mount(s.host,'bag');s.click('toggle');s.dialog.open=false;
  s.click('demo-0');assert.deepEqual(s.played,['pen']);
});

test('all study words produce an IPA display from the real data and absence of audio permits written practice',()=>{
  const s=open();vm.runInNewContext(source('vocab-data.js'),{window:s.window});
  for(const entry of s.window.EnglishWords) {
    s.state.word=entry;s.window.Phonics.mount(s.host,entry);
    assert.ok(s.host.innerHTML.includes(s.window.VocabIPA[entry.word].ipa),entry.word);
  }
  s.window.WordAudio.has=()=>false;s.window.WordAudio.hasSound=()=>false;s.click('toggle');s.click('demo-2');s.click('example');assert.match(s.live.textContent,/录音暂不可用/);
  s.click('start');s.click('reveal');assert.match(s.host.innerHTML,/挑战词 <b lang="en">/);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function listen(){
  const players=[];
  class Audio {
    constructor(src){this.src=src;players.push(this);}
    play(){return Promise.resolve();}
    pause(){this.stopped=true;}
  }
  const w={Audio,addEventListener(){}};
  const env={window:w,document:{addEventListener(){}}};
  for (const name of ['vocab-data','vocab-ipa','word-audio-data','vowel-audio-data','word-audio']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',name+'.js'),'utf8'),env);
  }
  return {w,players};
}
test('every vocabulary card has an IPA entry and local recording, and the four teaching vowels have separate clips',()=>{
  const {w}=listen();
  assert.equal(w.EnglishWords.length,120);
  assert.deepEqual(Object.keys(w.WordRecordings).sort(),Array.from(w.EnglishWords,x=>x.word).sort());
  for(const entry of w.EnglishWords){
    const ipa=w.VocabIPA[entry.word];
    assert.ok(ipa.ipa && ipa.focus.sound && ipa.focus.letters,entry.word);
    assert.ok(w.WordAudio.has(entry.word));
  }
  assert.deepEqual(Object.keys(w.VowelRecordings).sort(),['æ','ɛ','ɪ','ʊ'].sort());
  for(const encoded of Object.values({...w.WordRecordings,...w.VowelRecordings})){
    const raw=Buffer.from(encoded,'base64');
    assert.ok(raw.length>350 && raw[0]===255 && (raw[1]&224)===224,'expected a self-contained MP3 clip');
  }
});
test('changing from a vowel to a word stops the old player and resolves its request without replaying',async()=>{
  const {w,players}=listen();
  const sound=w.WordAudio.playSound('ɛ');
  const first=players.at(-1),lateEnd=first.onended;
  const word=w.WordAudio.play('pen',.8);
  assert.equal(await sound,false);
  assert.ok(first.stopped);lateEnd();
  const last=players.at(-1);
  assert.ok(last.src.startsWith('data:audio/mpeg;base64,'));
  assert.equal(last.playbackRate,.8);
  last.onended();assert.equal(await word,true);
  assert.equal(await w.WordAudio.playSound('?'),false);
});

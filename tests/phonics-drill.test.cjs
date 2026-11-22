const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const window = {addEventListener() {}};
const document = {addEventListener() {}};
for (const script of ['vocab-data','vocab-ipa','phonics-drill','vowel-audio-data','phoneme-audio-data','word-audio-data','word-audio']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist', script + '.js'), 'utf8'), {window, document});
}
const drill = window.PhonicsDrill;

// Independent broad US reference, checked against CMUdict 7479086. ∅ marks a
// written letter with no separate sound. Word dividers below are teaching units.
const gold = {
  egg: 'e gg|ɛ ɡ', bus: 'b u s|b ʌ s', run: 'r u n|r ʌ n', ask: 'a s k|æ s k',
  help: 'h e l p|h ɛ l p', west: 'w e s t|w ɛ s t', clock: 'c l o ck|k l ɑ k',
  sing: 's i ng|s ɪ ŋ', drink: 'd r i n k|d r ɪ ŋ k', school: 's ch oo l|s k u l',
  room: 'r oo m|r u m', eat: 'ea t|i t', read: 'r ea d|r i d', speak: 's p ea k|s p i k',
  bread: 'b r ea d|b r ɛ d', sleep: 's l ee p|s l i p', play: 'p l ay|p l eɪ',
  rain: 'r ai n|r eɪ n', count: 'c ou n t|k aʊ n t', right: 'r igh t|r aɪ t',
  home: 'h o m e|h oʊ m ∅', bike: 'b i k e|b aɪ k ∅', late: 'l a t e|l eɪ t ∅',
  safe: 's a f e|s eɪ f ∅', mother: 'm o th er|m ʌ ð ɚ', father: 'f a th er|f ɑ ð ɚ',
  sister: 's i s t er|s ɪ s t ɚ', friend: 'f r ie n d|f r ɛ n d', park: 'p a r k|p ɑ r k',
  pencil: 'p e n c i l|p ɛ n s ə l'
};
const originals = 'book bag pen desk bed milk fish map stop left jump swim'.split(' ');

test('30 new words match the reviewed US phones, letter boundaries and stress; each has a distinct transfer scene', () => {
  assert.equal(Object.keys(gold).length, 30);
  assert.equal(Object.keys(gold).filter(id => originals.includes(id)).length, 0);
  for (const [id, reference] of Object.entries(gold)) {
    const entry = window.EnglishWords.find(w => w.word === id);
    const data = window.VocabIPA[id];
    const [letters, sounds] = reference.split('|');
    assert.equal(Array.from(data.parts, p => p[0]).join(' '), letters, id);
    assert.equal(Array.from(data.parts, p => p[1]).join(' '), sounds, id);
    const stress = ['mother','father','sister','pencil'].includes(id) ? 'ˈ' : '';
    assert.equal(data.ipa, stress + sounds.replaceAll(' ', '').replaceAll('∅',''), id);
    assert.ok(data.parts.some(([l,s]) => l === data.focus.letters && s === data.focus.sound), id);
    assert.match(entry.scene.zh, /[\u3400-\u9fff]/);
    assert.equal(entry.scene.prompt.match(/___/g)?.length, 1);
    assert.doesNotMatch(entry.scene.prompt, new RegExp('\\b' + id + '\\b','i'));
    assert.notEqual(entry.scene.prompt, entry.prompt);
    assert.notEqual(entry.scene.prompt.replace('___',id), entry.example);
  }
});

test('every aligned word, sound choice and blending tile has usable offline data, including the original twelve', () => {
  for (const id of [...originals, ...Object.keys(gold)]) assert.ok(window.VocabIPA[id].parts, id);
  for (const [id, entry] of Object.entries(window.VocabIPA)) {
    if (!entry.parts) {
      assert.equal(drill.create(id), null);
      continue;
    }
    const d = drill.create(id);
    assert.ok(drill.valid(id,d), id);
    assert.equal(d.cursor,-1);
    assert.equal(entry.parts.map(p => p[0]).join(''), id);
    assert.equal(entry.parts.map(p => p[1]).join('').replaceAll('∅',''), entry.ipa.replace(/[ˈˌ]/g,''));
    assert.ok(window.WordAudio.has(id));
    assert.ok(d.options.includes(drill.vowelFor(id)), id);
    assert.equal(new Set(d.options).size, 2);
    for (const sound of [...d.options,...entry.parts.map(p => p[1])].filter(s => s !== '∅')) {
      assert.ok(window.WordAudio.hasSound(sound), id + ' /' + sound + '/');
      const mp3 = Buffer.from((window.PhonemeRecordings[sound] || window.VowelRecordings[sound]),'base64');
      assert.ok(mp3.length > 350 && mp3[0] === 255 && (mp3[1] & 224) === 224, sound);
    }
  }
  assert.equal(window.WordAudio.hasSound('∅'), false);
});

test('listening hides the target, repeated tiles stay selectable, silent e can be placed without sound', () => {
  function card(word, cursor) {
    const d = drill.create(word);
    d.cursor = cursor;
    return drill.card({word: window.EnglishWords.find(w => w.word === word), drill: d, phase: cursor < 0 ? 'listen' : 'blend'});
  }
  assert.doesNotMatch(card('pencil', -1), /pencil|pɛnsəl/i);
  assert.match(card('sister', 2), /data-drill-pick="s" lang="en"/);
  assert.match(card('sister', 3), /data-drill-pick="s" disabled/);
  assert.doesNotMatch(card('bike', 3), /data-drill-audio="part"/);
  assert.match(card('bike', 3), /不单独发音/);
  assert.match(card('bike', 4), /听分音，再听整词/);
});

test('a corrupt or mismatched saved drill returns to its word card', () => {
  const d = drill.create('bike');
  for (const bad of [{...d,cursor:10},{...d,cursor:1.5},{...d,tiles:['b','i','k','k']},
      {...d,options:[d.options[0],d.options[0]]},{...d,options:['aɪ','x']},null]) {
    assert.equal(drill.valid('bike', bad), false);
  }
  assert.equal(drill.valid('pencil', d), false);
});

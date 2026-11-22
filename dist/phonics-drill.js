/* The guided steps on a fully aligned word use only embedded US sound clips. */
(() => {
  'use strict';
  const vowels = {
    'æ': ['ɛ', '嘴张得较大，舌头靠前。'], 'ɛ': ['æ', '舌头靠前，嘴张得比 /æ/ 小。'],
    'ɪ': ['i', '嘴唇放松，声音短促。'], 'i': ['ɪ', '舌头向前抬高，嘴角稍向两边。'],
    'ʊ': ['u', '双唇轻轻收圆，舌头放松。'], 'u': ['ʊ', '双唇收圆，舌头向后抬高。'],
    'ʌ': ['ɑ', '双唇放松，在嘴巴中间发声。'], 'ɑ': ['ʌ', '嘴张大，舌头放低、靠后。'],
    'eɪ': ['aɪ', '嘴微张，然后向 /ɪ/ 滑动。'], 'aɪ': ['eɪ', '从张大的口形向 /ɪ/ 滑动。'],
    'oʊ': ['aʊ', '从半圆的口形开始，双唇逐渐收拢。'], 'aʊ': ['oʊ', '从张大的口形开始，双唇逐渐收圆。']
  };
  function vowelFor(id) {
    const entry = window.VocabIPA?.[id];
    if (!entry?.parts?.length) return null;
    const stressed = entry.ipa.slice(entry.ipa.indexOf('ˈ') + 1);
    const vowel = stressed.match(/[aeiouæɑɪʊʌɛəɚɝɔɜ][ɪʊ]?/u)?.[0];
    return Object.hasOwn(vowels, vowel) ? vowel : null;
  }

  function create(id) {
    const vowel = vowelFor(id);
    if (!vowel) return null;
    const letters = [...new Set(window.VocabIPA[id].parts.map(([part]) => part))];
    const tiles = [...letters];
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (tiles.length > 1 && tiles.every((part, i) => part === letters[i])) tiles.push(tiles.shift());
    const options = [vowel, vowels[vowel][0]];
    if (Math.random() < .5) options.reverse();
    return {cursor: -1, tiles, options};
  }

  function valid(id, drill) {
    const vowel = vowelFor(id);
    if (!vowel || !drill || !Number.isInteger(drill.cursor)) return false;
    const parts = window.VocabIPA[id].parts;
    const sameSet = (a, b) => Array.isArray(a) && a.length === b.size && new Set(a).size === b.size && a.every(x => b.has(x));
    return drill.cursor >= -1 && drill.cursor <= parts.length &&
      sameSet(drill.tiles, new Set(parts.map(([part]) => part))) &&
      sameSet(drill.options, new Set([vowel, vowels[vowel][0]]));
  }

  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const soundLabel = sound => sound === '∅' ? '不单独发音' : '/' + escape(sound) + '/';
  const play = (key, label) => '<button type="button" class="vw-button" data-drill-audio="' + key + '">' + label + '</button>';

  function card(state) {
    const {word, drill, phase} = state;
    const parts = window.VocabIPA[word.word].parts;
    if (phase === 'listen') {
      const rows = drill.options.map((sound, i) => {
        const name = i === 0 ? 'A' : 'B';
        return '<div class="vw-sound-option">' + play('sample-' + i, '听 ' + name + ' ' + soundLabel(sound)) +
          '<button type="button" class="vw-button" data-drill-pick="' + escape(sound) + '">选 ' + name + '</button></div>';
      }).join('');
      return '<h3 id="vw-focus">听一听，哪个元音相同？</h3><p>听单词，再比较 A 和 B。多音节词听读得最重的那一拍。</p>' +
        play('word', '重听单词') + '<div class="vw-sounds">' + rows + '</div>' +
        '<details><summary>看口形提示</summary><p>读这个词时，' + escape(vowels[vowelFor(word.word)][1]) + '</p>' +
        drill.options.map((v,i) => '<p>' + (i ? 'B' : 'A') + ' ' + soundLabel(v) + '　' + escape(vowels[v][1]) + '</p>').join('') + '</details>';
    }
    if (drill.cursor === parts.length) {
      return '<h3 id="vw-focus">连起来读一遍</h3><p class="vw-chunks" lang="en">' +
        parts.map(([letters, sound]) => '<span>' + escape(letters) + '<small>' + soundLabel(sound) + '</small></span>').join('') +
        '</p><p><strong lang="en">' + escape(word.word) + '</strong>　' + escape(word.zh) + '</p>' +
        play('sequence', '听分音，再听整词') +
        ' <button type="button" class="vw-button vw-primary" data-word-act="next">继续练习</button>';
    }
    const [letters, sound] = parts[drill.cursor];
    const built = parts.slice(0, drill.cursor).map(([chunk]) => chunk).join('');
    const remaining = parts.slice(drill.cursor).map(([chunk]) => chunk);
    const tiles = drill.tiles.map(chunk => '<button type="button" class="vw-button" data-drill-pick="' +
      escape(chunk) + '"' + (remaining.includes(chunk) ? '' : ' disabled') + ' lang="en">' + escape(chunk) + '</button>').join('');
    return '<h3 id="vw-focus">把声音拼成词</h3><p>' + escape(word.zh) + ' · 第 ' + (drill.cursor + 1) + ' / ' + parts.length + ' 块</p>' +
      '<p class="vw-built" lang="en">' + escape(built) + '＿</p><p>' + (sound === '∅' ? '这一块要写出来，读整词时不单独发音。' :
        '听 ' + soundLabel(sound) + '，点这一块的字母。') + '</p>' + (sound === '∅' ? '' : play('part', '再听这个音')) +
      '<div class="vw-chunks" role="group" aria-label="选字母块">' + tiles + '</div>' +
      '<details><summary>帮我找这一块</summary><p>点 <b lang="en">' + escape(letters) + '</b>，再接下一块。</p></details>';
  }
  window.PhonicsDrill = Object.freeze({vowelFor, create, valid, card});
})();

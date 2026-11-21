/* Spoken English is opt-in. The learning page and adventure share one speech queue. */
(() => {
  'use strict';

  let synth;
  try { synth = window.speechSynthesis; } catch (_) { /* Speech can be disabled by the host. */ }
  const Utterance = window.SpeechSynthesisUtterance;
  const supported = Boolean(synth && Utterance && typeof synth.speak === 'function');
  const home = document.getElementById('learn-home');
  const island = document.getElementById('game-dialog');
  const vocabulary = document.getElementById('vocab-dialog');
  let active = null;
  let islandPanel = null;

  function indicate(control, speaking) {
    control.button.textContent = speaking ? '停止朗读' : control.label;
    control.button.setAttribute('aria-pressed', String(speaking));
    control.button.setAttribute('aria-label', speaking ? '停止朗读' : control.description);
  }

  function stop() {
    if (!active) { window.WordAudio?.stop(); return; }
    const current = active;
    active = null;
    if (current.utterance) {
      current.utterance.onend = null;
      current.utterance.onerror = null;
    }
    indicate(current, false);
    window.WordAudio?.stop();
    try { if (current.utterance) synth.cancel(); } catch (_) { /* The device might already have stopped. */ }
  }

  function englishVoices() {
    const all = synth.getVoices?.() || [];
    const english = all.filter(v => /^en(?:[-_]|$)/i.test(v.lang));
    const preferred = list => list.find(v => /^en[-_]US$/i.test(v.lang)) ||
      list.find(v => /^en[-_]GB$/i.test(v.lang)) || list[0];
    return {voice:preferred(english.filter(v => v.localService)) || preferred(english),
      knownMissing:all.length > 0 && english.length === 0};
  }

  function visible(control) {
    return !document.hidden && control.button.isConnected &&
      (control.owner !== vocabulary || vocabulary?.open) &&
      ![...document.querySelectorAll('dialog[open]')].some(other => other !== control.owner);
  }

  function speak(control, getText) {
    const wasSame = active?.button === control.button;
    stop();
    if (wasSame || !visible(control)) return;
    const text = getText();
    if (typeof text !== 'string' || !text.trim()) return;
    control.status.textContent = '';
    if (control.localWord && window.WordAudio?.has(control.localWord)) {
      const attempt = {...control};
      active = attempt;
      indicate(control,true);
      const finish = ok => {
        if (active !== attempt) return;
        active = null;
        indicate(control,false);
        if (ok || !visible(control) || getText() !== text) return;
        if (supported) speakSystem(control,text);
        else control.status.textContent = '这台设备暂时无法播放，可继续阅读。';
      };
      try { Promise.resolve(window.WordAudio.play(control.localWord)).then(finish,() => finish(false)); }
      catch (_) { finish(false); }
      return;
    }
    if (supported) speakSystem(control,text);
  }

  function speakSystem(control,text) {
    try {
      const {voice, knownMissing} = englishVoices();
      if (knownMissing) {
        control.status.textContent = '设备没有可用的英语语音，可继续阅读。';
        return;
      }
      const utterance = new Utterance(text.trim());
      utterance.lang = voice?.lang?.replace(/_/g, '-') || 'en-US';
      if (voice) utterance.voice = voice;
      utterance.rate = 0.86;
      const finish = failed => {
        if (active?.utterance !== utterance) return;
        active = null;
        indicate(control, false);
        if (failed) control.status.textContent = '这台设备暂时无法朗读，可继续阅读。';
      };
      utterance.onend = () => finish(false);
      utterance.onerror = event => finish(!['interrupted','canceled'].includes(event.error));
      active = {...control, utterance};
      indicate(control, true);
      synth.speak(utterance);
    } catch (_) {
      stop();
      control.status.textContent = '这台设备暂时无法朗读，可继续阅读。';
    }
  }

  function addControl(container, owner, label, description, getText, localWord) {
    const button = document.createElement('button');
    button.type = 'button';
    const status = document.createElement('span');
    status.setAttribute('role','status');
    const control = {button,status,owner,label,description,localWord};
    indicate(control,false);
    button.addEventListener('click', () => speak(control,getText));
    container.append(button,status);
  }

  function modelText(id) {
    if (!home || home.hidden || home.closest('[inert]')) return '';
    const state = window.LearnRound?.getState?.();
    if (state?.mode !== 'learn' || state.phase !== 'question' ||
        state.question?.subject !== 'english' || state.question.id !== id || !state.question.clue) return '';
    return window.LearnFacts?.[id]?.model?.en || '';
  }

  function mountControl(container, owner, label, description, fallback, getText, localWord) {
    if (!container) return;
    if (active && container.contains(active.button)) stop();
    container.replaceChildren();
    if (!owner || !getText()) return;
    if (!supported && !(localWord && window.WordAudio?.has(localWord))) {
      container.textContent = fallback;
      return;
    }
    addControl(container,owner,label,description,getText,localWord);
  }

  function mountModel(container, id) {
    mountControl(container,home,'听示范','听本题的英语示范','可照着范句跟读。',() => modelText(id));
  }

  function mountWord(container, id, kind = 'word') {
    const wordId = typeof id === 'string' ? id : id?.word;
    const example = kind === 'example';
    const vocabularyText = () => {
      const state = window.WordPractice?.getState?.();
      if (!state?.word || state.word.word !== wordId || (!example && kind !== 'word')) return '';
      const revealed = state.phase === 'feedback' && ['correct','revealed','assisted'].includes(state.feedback?.kind);
      if (state.phase !== 'study' && !revealed) return '';
      return example ? state.word.example : state.word.word;
    };
    mountControl(container,vocabulary,example ? '听例句' : '听单词',
      example ? '朗读当前词卡的英语例句' : '朗读当前英语单词',
      example ? '' : '可照着词卡跟读。',vocabularyText,example ? null : wordId);
  }

  function attachIsland() {
    if (active?.owner === island) stop();
    islandPanel?.remove();
    islandPanel = null;
    if (!island.open || !island.querySelector('.gm-art-forest')) return;
    const passage = island.querySelector('.gm-note p, .gm-fact');
    if (!passage) return;
    // Only read words the student has already uncovered in this clue or card.
    const phrases = passage.textContent.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*(?:[ \t]+[A-Za-z]+(?:[’'-][A-Za-z]+)*)*[?!.]?/g);
    if (!phrases?.length) return;
    const text = phrases.map(part => /[?!.]$/.test(part) ? part : part + '.').join(' ');
    islandPanel = document.createElement('div');
    islandPanel.className = 'gm-voice';
    addControl(islandPanel,island,'听英语','朗读此处英语',() => island.open && passage.isConnected ? text : '');
    (passage.closest('.gm-note') || passage).after(islandPanel);
  }

  window.LearnVoice = Object.freeze({mountModel,mountWord,stop});
  if (supported || vocabulary) {
    const screens = document.querySelectorAll('dialog');
    const watchDialogs = new MutationObserver(records => {
      if (active && records.some(({target}) => target === active.owner ? !target.open : target.open)) stop();
    });
    screens.forEach(screen => watchDialogs.observe(screen,{attributes:true,attributeFilter:['open']}));
    if (supported && island) {
      new MutationObserver(attachIsland).observe(island,{childList:true,attributes:true,attributeFilter:['open']});
      island.addEventListener('close',stop);
      attachIsland();
    }
    if (vocabulary) {
      vocabulary.addEventListener('close',() => { if (active?.owner === vocabulary) stop(); });
      new MutationObserver(() => {
        if (active?.owner === vocabulary && !active.button.isConnected) stop();
      }).observe(vocabulary,{childList:true,subtree:true});
    }
    if (home) new MutationObserver(() => {
      if (home.hidden && active?.owner === home) stop();
    }).observe(home,{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('pagehide',stop);
    document.addEventListener('visibilitychange',() => { if (document.hidden) stop(); });
  }
  window.dispatchEvent(new Event('learn-voice-ready'));
})();

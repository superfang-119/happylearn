/* Optional, user-initiated English pronunciation for discovered clues and cards. */
(() => {
  'use strict';

  const dialog = document.getElementById('game-dialog');
  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  if (!dialog || !synth || !Utterance) return;

  let current = null;
  let panel = null;

  function stop() {
    if (!current) return;
    const { button } = current;
    current = null;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '听英语';
    synth.cancel();
  }

  function englishVoice() {
    const voices = synth.getVoices();
    const english = voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
    return english.find(voice => voice.localService) || english[0];
  }

  function play(text, button, status) {
    if (current) {
      stop();
      return;
    }
    const utterance = new Utterance(text);
    const voice = englishVoice();
    utterance.lang = voice?.lang || 'en-US';
    if (voice) utterance.voice = voice;
    utterance.rate = 0.85;
    status.textContent = '';
    button.textContent = '停止朗读';
    button.setAttribute('aria-pressed', 'true');
    current = { button, utterance };
    const finish = event => {
      if (current?.utterance !== utterance) return;
      current = null;
      button.textContent = '听英语';
      button.setAttribute('aria-pressed', 'false');
      if (event.type === 'error') status.textContent = '这台设备暂时无法朗读英语。';
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    try { synth.speak(utterance); }
    catch { finish({ type: 'error' }); }
  }

  function attach() {
    stop();
    panel?.remove();
    panel = null;
    if (!dialog.open || !dialog.querySelector('.gm-art-forest')) return;
    const passage = dialog.querySelector('.gm-note p, .gm-fact');
    if (!passage) return;

    // Only copy English the student has already uncovered on screen.
    const phrases = passage.textContent.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*(?:[ \t]+[A-Za-z]+(?:[’'-][A-Za-z]+)*)*[?!.]?/g);
    if (!phrases?.length) return;
    const text = phrases.map(part => /[?!.]$/.test(part) ? part : part + '.').join(' ');
    panel = document.createElement('div');
    panel.className = 'gm-voice';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '听英语';
    button.setAttribute('aria-label', '朗读此处英语');
    button.setAttribute('aria-pressed', 'false');
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    button.addEventListener('click', () => play(text, button, status));
    panel.append(button, status);
    const anchor = passage.closest('.gm-note') || passage;
    anchor.after(panel);
  }

  // The game replaces its direct shell on navigation. Observing only that
  // boundary keeps inserted controls and playback labels out of the observer.
  new MutationObserver(attach).observe(dialog, { childList: true, attributes: true, attributeFilter: ['open'] });
  dialog.addEventListener('close', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  attach();
})();

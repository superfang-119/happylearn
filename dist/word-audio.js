/* Recorded words also play when the browser has no English speech service. */
(() => {
  'use strict';
  const recordings = window.WordRecordings || {};
  const sounds = {...window.VowelRecordings, ...window.PhonemeRecordings};
  let current = null;
  const has = word => typeof word === 'string' && Object.hasOwn(recordings,word);

  function stop() {
    if (!current) return;
    const playing=current;
    current=null;
    playing.player.onended=null;
    playing.player.onerror=null;
    playing.player.pause();
    playing.resolve(false);
  }
  const hasSound = ipa => typeof ipa === 'string' && Object.hasOwn(sounds,ipa);
  function playClip(clip,rate) {
    stop();
    if (!clip || typeof window.Audio !== 'function') return Promise.resolve(false);
    return new Promise(resolve=>{
      let player;
      try {
        player=new window.Audio('data:audio/mpeg;base64,'+clip);
        player.playbackRate=Number.isFinite(rate)?Math.min(1.25,Math.max(0.65,rate)):1;
      } catch {resolve(false);return;}
      const session={player,resolve};
      current=session;
      function finish(ok) {
        if(current!==session)return;
        current=null;player.onended=null;player.onerror=null;resolve(ok);
      }
      player.onended=()=>finish(true);
      player.onerror=()=>finish(false);
      try {player.play()?.catch(()=>finish(false));}
      catch {finish(false);}
    });
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  const play = (word,rate=1)=>playClip(has(word)?recordings[word]:null,rate);
  const playSound = (ipa,rate=1)=>playClip(hasSound(ipa)?sounds[ipa]:null,rate);
  window.WordAudio=Object.freeze({has,play,hasSound,playSound,stop});
})();

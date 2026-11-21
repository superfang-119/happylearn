/* An optional pronunciation lesson on an already-visible vocabulary card. */
(() => {
  'use strict';

  const ears = [
    {sound:'æ', word:'bag', tests:['bag','map'], tip:'嘴张得比较开，舌尖靠近下门牙。听 bag 中间的元音。'},
    {sound:'ɛ', word:'pen', tests:['pen','bed'], tip:'嘴自然张开，舌头略向前。和 bag 相比，读 pen 时嘴张得小一些。'},
    {sound:'ɪ', word:'fish', tests:['fish','milk'], tip:'嘴唇自然放松，舌头稍抬高。听 fish 中短短的元音。'},
    {sound:'ʊ', word:'book', tests:['book'], tip:'双唇轻轻收圆，舌头稍向后。听 book 中短短的元音。'}
  ];
  const simpleTips = {
    b:'先闭上双唇，再轻轻放开。跟着单词读，后面不用再添一个元音。',
    p:'双唇先合拢，再放开，让气流从嘴里出来。',
    k:'舌后部短暂贴住上方，再放开。做结尾时不要再加一个元音。',
    m:'双唇闭合，让声音从鼻腔出来。可以轻轻摸摸鼻子。',
    n:'舌尖贴住上齿龈，让声音从鼻腔出来。',
    f:'上齿轻触下唇，从缝隙轻轻送气。',
    s:'舌尖靠近上齿龈，留一条窄缝让气流通过。',
    t:'舌尖先贴上齿龈，再轻轻放开。',
    d:'舌尖先贴上齿龈，再放开，读进接下来的音。',
    ʃ:'嘴唇稍向前，舌面靠近上方，让气流通过。',
    ...Object.fromEntries(ears.map(e => [e.sound,e.tip]))
  };
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const symbol = sound => sound && sound !== '∅' ? '/'+escape(sound)+'/' : '不单独发音';
  const choose = list => list[Math.floor(Math.random()*list.length)];
  let current = null;
  let playSerial = 0;

  function stop() {
    ++playSerial;
    if (current?.playing) {
      current.playing = false;
      window.WordAudio?.stop();
    }
  }

  function allowed(word) {
    const s = window.WordPractice?.getState?.();
    return s?.word?.word === word && (s.phase === 'study' || (s.phase === 'feedback' &&
      ['revealed','correct','assisted'].includes(s.feedback?.kind)));
  }

  function visible(s) {
    return s === current && s.host.isConnected && !document.hidden &&
      document.getElementById('vocab-dialog')?.open && allowed(s.word);
  }

  function tell(s,text) {
    const live = s.host.querySelector('.ph-live');
    if (live) live.textContent = text;
  }

  function play(s, value, isolated=false) {
    stop();
    window.LearnVoice?.stop();
    if (!visible(s)) return;
    const audio = window.WordAudio;
    if (!(isolated ? audio?.hasSound?.(value) : audio?.has(value))) {
      tell(s,'录音暂不可用，可以看字母和音标继续练习。');
      return;
    }
    s.playing = true;
    const serial = ++playSerial;
    const finish = ok => {
      if (serial !== playSerial || s !== current) return;
      s.playing = false;
      if (!ok && visible(s)) tell(s,'可以再播放一次，或用文字继续练习。');
    };
    try { Promise.resolve(isolated ? audio.playSound(value) : audio.play(value)).then(finish,() => finish(false)); }
    catch (_) { finish(false); }
  }

  function partHelp(s) {
    const [letters,sound] = s.parts[s.part];
    const text = letters === s.data.focus?.letters && sound === s.data.focus?.sound
      ? s.data.focus.tip : simpleTips[sound];
    return escape(text || (sound && sound !== '∅'
      ? '听整词时，留意 '+letters+' 在这个词里对应的声音。' : '这处字母在本词里不单独发音。'));
  }

  function actions(s) {
    const t = s.trial;
    if (!t) return '<button type="button" data-ph="start" class="ph-start" '+(s.demonstrated?'':'disabled')+'>开始辨音</button>';
    const options = t.options.map(id => {
      const picked=t.wrong===id || (t.done && t.correct===id);
      return '<button type="button" data-ph="answer-'+id+'" aria-pressed="'+picked+'" '+
        ((t.done||t.wrong===id)?'disabled':'')+'><b>/'+ears[id].sound+'/</b>　像 <span lang="en">'+ears[id].word+'</span></button>';
    }).join('');
    const feedback=t.done?'<p class="ph-feedback" role="status">听对了！<span lang="en">'+t.word+
      '</span> 的元音是 /'+ears[t.correct].sound+'/。</p>':t.wrong!==null?
      '<p class="ph-feedback" role="status">再听听。'+escape(ears[t.correct].tip)+'</p>':'';
    return '<div class="ph-trial"><div class="ph-trial-top"><b>你听到哪个元音？</b>'+
      '<button type="button" data-ph="replay" class="ph-audio">重听挑战词</button></div>'+
      '<div class="ph-choices" role="group" aria-label="选择听到的元音">'+options+'</div>'+feedback+
      (t.done?'<button type="button" data-ph="start" class="ph-start">再听一题</button>':
      t.shown?'<small>挑战词 <b lang="en">'+t.word+'</b></small>':'<button type="button" data-ph="reveal" class="ph-link">看挑战词</button>')+'</div>';
  }

  function render(s, focusAction) {
    const data=s.data, focus=data.focus;
    let expanded='';
    if (s.open) {
      const parts=s.parts.map(([letters,sound],i) => '<button type="button" data-ph="part-'+i+'" aria-pressed="'+
        (s.part===i)+'"><span lang="en">'+escape(letters)+'</span><i aria-hidden="true">→</i><b>'+symbol(sound)+'</b></button>').join('');
      const selectedSound=s.parts[s.part]?.[1];
      const isolated=ears.some(e=>e.sound===selectedSound);
      const partsAudio='<div class="ph-players">'+(isolated?'<button type="button" data-ph="part-sound" class="ph-audio">听这个音 '+symbol(selectedSound)+'</button>':'')+
        '<button type="button" data-ph="whole" class="ph-audio">听整词 <span lang="en">'+escape(s.word)+'</span></button></div>';
      const example=s.demo===null?null:ears[s.demo];
      const demoAudio=example?'<div class="ph-players"><button type="button" data-ph="demo-sound" class="ph-audio">再听 /'+example.sound+
        '/</button><button type="button" data-ph="example" class="ph-audio">听例词 <span lang="en">'+example.word+'</span></button></div>':'';
      const demos=ears.map((e,i)=>'<button type="button" data-ph="demo-'+i+'" aria-pressed="'+(s.demo===i)+'">'+
        '<b>/'+e.sound+'/</b> <span lang="en">'+e.word+'</span></button>').join('');
      expanded='<div class="ph-body"><p class="ph-key">两条斜线中间是读音。看到 <b>ˈ</b>，就把它后面的音节读重一点。</p>'+
        (parts?'<div class="ph-parts" role="group" aria-label="点选字母，看对应读音">'+parts+'</div><p class="ph-tip" aria-live="polite">'+partHelp(s)+'</p>'+partsAudio:'')+
        '<div class="ph-ear"><h4>听一听短元音</h4><p>点一个音先听短元音，再听它在例词中的读法。</p>'+
        '<div class="ph-demos" role="group" aria-label="听元音例词">'+demos+'</div>'+
        (s.demo!==null?'<p class="ph-tip" aria-live="polite">'+escape(ears[s.demo].tip)+'</p>':'')+
        demoAudio+actions(s)+'</div><span class="ph-live" role="status"></span></div>';
    }
    s.host.innerHTML='<div class="ph-card"><button type="button" class="ph-toggle" data-ph="toggle" aria-expanded="'+s.open+'">'+
      '<span class="ph-notation">'+symbol(data.ipa)+'</span><span class="ph-caption">'+(focus?escape(focus.letters)+' 读 '+symbol(focus.sound):'单词读音')+
      '</span><span class="ph-toggle-text">'+(s.open?'收起':'学发音')+' <i aria-hidden="true">'+(s.open?'▴':'▾')+'</i></span></button>'+expanded+'</div>';
    if (focusAction) s.host.querySelector('[data-ph="'+focusAction+'"]')?.focus({preventScroll:true});
  }

  function begin(s) {
    if (!s.demonstrated) return;
    const alternatives=ears.map((_,i)=>i).filter(i=>i!==s.trial?.correct);
    const correct=choose(alternatives), other=choose(ears.map((_,i)=>i).filter(i=>i!==correct));
    const words=ears[correct].tests;
    const candidates=words.filter(w=>w!==s.trial?.word && w!==ears[s.demo]?.word);
    const word=choose(candidates.length?candidates:words);
    s.trial={correct,word,options:Math.random()<0.5?[correct,other]:[other,correct],done:false,shown:false,wrong:null};
    render(s,'replay');
    play(s,word);
  }

  function act(s, action) {
    if (!visible(s)) { stop(); return; }
    if (action==='toggle') {
      s.open=!s.open;if (!s.open) stop();render(s,'toggle');return;
    }
    if (!s.open) return;
    const [key,raw]=action.split('-'), i=Number(raw);
    if (action==='part-sound' && s.parts[s.part] && ears.some(e=>e.sound===s.parts[s.part][1])) {
      play(s,s.parts[s.part][1],true);
    } else if (action==='whole') {
      play(s,s.word);
    } else if (action==='demo-sound' && s.demo!==null) {
      play(s,ears[s.demo].sound,true);
    } else if (action==='example' && s.demo!==null) {
      s.demonstrated=true;render(s,'example');play(s,ears[s.demo].word);
    } else if (key==='part' && Number.isInteger(i) && s.parts[i]) {
      s.part=i;render(s,action);
    } else if (key==='demo' && Number.isInteger(i) && ears[i]) {
      s.demo=i;render(s,action);play(s,ears[i].sound,true);
    } else if (action==='start') begin(s);
    else if (action==='replay' && s.trial) play(s,s.trial.word);
    else if (action==='reveal' && s.trial && !s.trial.done) {
      s.trial.shown=true;render(s,'replay');
    } else if (key==='answer' && s.trial && !s.trial.done && s.trial.options.includes(i) && s.trial.wrong!==i) {
      const t=s.trial;
      if (i===t.correct) t.done=true; else t.wrong=i;
      render(s,t.done?'start':'replay');
    }
  }

  function mount(container, word) {
    if (!container) return;
    stop();
    if (current) { current.host.onclick=null; current.host.replaceChildren(); }
    current=null;
    container.replaceChildren();
    const id=typeof word==='string'?word:word?.word;
    const data=window.VocabIPA?.[id];
    if (!id || !data?.ipa || !allowed(id)) return;
    const parts=(Array.isArray(data.parts) && data.parts.length ? data.parts : data.focus ? [[data.focus.letters,data.focus.sound]] : [])
      .filter(item=>Array.isArray(item) && item.length>=2);
    const preferred=parts.findIndex(([letters,sound])=>letters===data.focus?.letters && sound===data.focus?.sound);
    const s={host:container,word:id,data,parts,part:Math.max(preferred,0),open:false,demo:null,demonstrated:false,trial:null,playing:false};
    current=s;
    container.onclick=e=>{
      const button=e.target.closest('button[data-ph]');
      if (button && !button.disabled && container.contains(button)) act(s,button.dataset.ph);
    };
    render(s);
  }

  const dialog=document.getElementById('vocab-dialog');
  if (dialog) {
    dialog.addEventListener('close',stop);
    new MutationObserver(() => {
      if (current?.playing && !visible(current)) stop();
    }).observe(dialog,{attributes:true,attributeFilter:['open'],childList:true,subtree:true});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  window.Phonics=Object.freeze({mount,stop});
})();

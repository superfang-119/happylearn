/* Diagnostic and targeted English practice share the same assessment engine and local recordings. */
(() => {
  'use strict';

  const dialog = document.getElementById('english-check-dialog');
  if (!dialog) return;
  const skills = [
    ['listening','听力','听词辨义'], ['spelling','拼写','独立写词'], ['grammar','语法','在句中选用'],
    ['reading','阅读','读短文找信息'], ['writing','写作','排词成句']
  ];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const buttons = (key,text,style='') => '<button type="button" class="ec-button '+style+'" data-ec="'+key+'">'+text+'</button>';
  const label = (id,stats) => stats?.bySkill?.[id]?.name || skills.find(s=>s[0]===id)?.[1] || '英语';
  const validSkill = id => skills.some(s=>s[0]===id);
  const running = s => s?.phase==='question' || s?.phase==='feedback';
  const title = s => s.mode==='diagnostic' ? '五项诊断' : label(s.skill,s.stats)+'专项';
  const engine = () => window.EnglishCheck;
  let opener = null, page = 'list', nextDialog = '';
  let state = null, draftKey = '', text = '', selected = null, arranged = [];
  let heard = false, playing = false, playId = 0, busy = false;

  dialog.innerHTML='<header class="ec-head"><span class="ec-mark"><img src="art/english.png" width="30" height="30" alt=""></span>'+
    '<h2 id="english-check-title">英语提分练</h2><button type="button" class="ec-close" data-ec="close" aria-label="关闭英语提分练">×</button></header>'+
    '<div class="ec-scroll"><div class="ec-body"></div></div><p class="ec-live" role="status" aria-live="polite"></p>';
  const body=dialog.querySelector('.ec-body'), scroll=dialog.querySelector('.ec-scroll'), live=dialog.querySelector('.ec-live');

  function stopAudio() {
    ++playId;
    if (playing) window.WordAudio?.stop();
    playing=false;
  }
  function resetDraft() {
    stopAudio();draftKey='';text='';selected=null;arranged=[];heard=false;
  }
  function key(s) {return [s.mode,s.skill,s.question?.id,s.position].join('|');}
  function lessonLink() {
    return window.LearnJournal?.open ? buttons('journal','当天知识讲解','ec-link') : '';
  }
  function weakBlock(stats) {
    const weak=skills.filter(([id])=>stats?.weakSkills?.includes(id));
    if (!weak.length) return '';
    return '<section class="ec-weak"><h4>建议先练</h4><div>'+weak.map(([id])=>buttons('practice-'+id,
      '<strong>'+escape(label(id,stats))+'</strong><span>练 3 题</span>','ec-weak-button')).join('')+'</div></section>';
  }
  function overview() {
    const stats=state.stats || engine().stats(), count=skills.filter(([id])=>(stats.bySkill?.[id]?.attempts || 0)>0).length;
    const keep=running(state);
    const hero=keep?'<h3 id="ec-focus" tabindex="-1">'+escape(title(state))+'进行中</h3><p>已到第 '+state.position+' / '+state.total+' 题，可以接着做。</p>'+
      buttons('resume','继续当前练习','ec-primary'):
      '<h3 id="ec-focus" tabindex="-1">五项诊断</h3><p>'+(count?
      '听力、拼写、语法、阅读和写作各做一道，看看这次的变化。':'还没有测评记录。每项做一道，找出最值得先练的地方。')+
      '</p>'+buttons('diagnostic','开始 5 题诊断','ec-primary');
    const list=skills.map(([id,,desc])=>{
      const record=stats.bySkill?.[id], attempts=Number(record?.attempts)||0, weak=stats.weakSkills?.includes(id);
      const status=weak?'建议巩固':attempts?'已练 '+attempts+' 题':'尚未练习';
      return '<button type="button" class="ec-skill" data-ec="practice-'+id+'"><span><b>'+escape(label(id,stats))+
        '</b><small>'+escape(desc)+'</small></span><span class="ec-row-tail"><em>'+status+'</em><strong>练 3 题</strong></span></button>';
    }).join('');
    const exam=window.ExamBridge?.open?'<button type="button" class="ec-exam" data-ec="exam"><span><strong>中高考真题</strong>'+
      '<small>先做七上变式，再挑战真题。</small></span><b>进入练习</b></button>':'';
    return '<section class="ec-intro">'+hero+'</section>'+exam+weakBlock(stats)+
      '<section class="ec-library"><h4>按专项练习</h4><div class="ec-list">'+list+'</div></section>'+
      '<div class="ec-foot-links">'+(keep && state.mode!=='diagnostic'?buttons('diagnostic','改做五项诊断','ec-link'):'')+lessonLink()+'</div>';
  }

  function progress(s) {
    return '<div class="ec-progress"><span>'+escape(title(s))+'</span><b>第 '+s.position+' / '+s.total+' 题</b></div>'+
      '<progress class="ec-meter" value="'+(s.position-1+(s.phase==='feedback'?1:0))+'" max="'+s.total+'" aria-label="练习进度"></progress>';
  }
  function audioButton(q) {
    if (!q.audioWord) return '';
    return '<div class="ec-audio"><button type="button" class="ec-play" data-ec="audio" aria-pressed="'+playing+'">'+
      (playing?'停止播放':heard?'重听录音':'播放录音')+'</button><span class="ec-audio-note" role="status">'+
      (playing?'正在播放…':heard?'已播放，可以作答。':'先听录音，再选择答案。')+'</span>'+
      '<button type="button" class="ec-button ec-link" data-ec="unavailable">听不到声音，换一题</button></div>';
  }
  function orderParts(q) {
    const line=arranged.map((n,position)=>'<button type="button" data-order-drop="'+position+'" class="ec-token ec-added" '+
      'aria-label="移回第 '+(position+1)+' 个词块 '+escape(q.options[n])+'">'+escape(q.options[n])+'<i aria-hidden="true">×</i></button>').join('');
    const bank=q.options.map((word,i)=>'<button type="button" class="ec-token" data-order-add="'+i+'" '+
      (arranged.includes(i)?'disabled ':'')+'lang="en">'+escape(word)+'</button>').join('');
    return '<div class="ec-order"><b>你的句子</b><div class="ec-sentence" role="group" aria-label="你的句子，点已选词块可移回">'+
      (line||'<small>按顺序选择下方的词块。</small>')+'</div><div class="ec-word-bank" role="group" aria-label="可选词块">'+bank+'</div></div>';
  }
  function answerControls(q) {
    if (q.type==='text') return '<label class="ec-text"><span>你的拼写</span><input data-ec-text type="text" maxlength="180" lang="en" '+
      'inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" value="'+escape(text)+'" placeholder="在这里输入英文"></label>';
    if (q.type==='order') return orderParts(q);
    return '<div class="ec-choices" role="radiogroup" aria-label="选择答案">'+q.options.map((value,i)=>
      '<label class="ec-choice"><input type="radio" name="english-check-choice" data-ec-choice="'+i+'" '+
      (selected===i?'checked ':'')+'><span>'+escape(value)+'</span></label>').join('')+'</div>';
  }
  function question() {
    const q=state.question, f=state.feedback;
    if (!q) return overview();
    const heading=progress(state)+'<div class="ec-q-head"><span>'+escape(q.skillName||label(q.skill,state.stats))+'</span>'+
      '<h3 id="ec-focus" tabindex="-1">'+escape(q.prompt)+'</h3></div>';
    const passage=q.passage?'<div class="ec-passage" lang="en">'+escape(q.passage)+'</div>':'';
    if (state.phase==='feedback' && f) {
      const device=f.kind==='unavailable';
      const verdict=device?'本题不计入测评':f.kind==='correct'?'答对了':f.kind==='skipped'?'一起看怎么做':'看看这道题';
      const answer=f.answerText && !device?'<p class="ec-standard"><span>参考答案</span> <b>'+escape(f.answerText)+'</b></p>':'';
      const note=device?'本次听力未计入尝试次数，也不会改变薄弱项。':f.explain;
      return heading+passage+'<section class="ec-feedback '+(f.correct?'ec-correct':'')+'"><h4 id="ec-verdict" tabindex="-1">'+verdict+'</h4>'+
        answer+'<p>'+escape(note)+'</p></section><div class="ec-actions">'+buttons('next',state.position===state.total?'看本次结果':'下一题','ec-primary')+
        buttons('list','回到练习清单','ec-link')+'</div>';
    }
    return heading+passage+(q.instruction?'<p class="ec-instruction">'+escape(q.instruction)+'</p>':'')+audioButton(q)+
      '<form class="ec-form" novalidate>'+answerControls(q)+'<div class="ec-actions"><button type="submit" class="ec-button ec-primary" '+
      (q.audioWord && !heard?'disabled ':'')+'>提交答案</button><button type="button" class="ec-button" data-ec="skip" '+
      (q.audioWord && !heard?'disabled ':'')+'>还不会</button></div></form>'+
      '<div class="ec-foot-links">'+buttons('list','回到练习清单','ec-link')+'</div>';
  }
  function complete() {
    const results=state.results || [], correct=results.filter(r=>r.kind==='correct').length;
    const graded=results.filter(r=>r.kind!=='unavailable').length;
    const rows=results.map((r,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'　'+escape(label(r.skill,state.stats))+
      '</span><b>'+({correct:'答对',wrong:'待巩固',skipped:'还不会',unavailable:'未测听力'}[r.kind]||'已完成')+'</b></li>').join('');
    let next=weakBlock(state.stats);
    if (!next) next='<p class="ec-summary-note">'+(graded===0?'还没有可计入的答案，可以换一个专项练习。':
      correct===graded?'本次计分的题都答对了。':'可以从练习清单里挑一项再做三题。')+'</p>';
    return '<section class="ec-intro"><h3 id="ec-focus" tabindex="-1">'+escape(title(state))+'完成</h3><p>'+
      (graded?'本次计分 '+graded+' 题，独立答对 '+correct+' 题。':'本次没有计分题。')+'</p></section>'+
      '<ul class="ec-results" aria-label="本次练习结果">'+rows+'</ul>'+next+
      '<div class="ec-actions">'+buttons('list','回到练习清单','ec-primary')+lessonLink()+'</div>';
  }

  function render(focus=true) {
    if (!dialog.open) return;
    if (running(state) && key(state)!==draftKey) {resetDraft();draftKey=key(state);}
    live.textContent='';
    body.innerHTML=page==='list'?overview():state.phase==='complete'?complete():question();
    if (focus) {
      scroll.scrollTop=0;
      body.querySelector(page!=='list'&&state.phase==='feedback'?'#ec-verdict':'#ec-focus')?.focus({preventScroll:true});
    }
  }
  function showState(next, focus=true) {
    state=next || engine().getState();
    page=state.phase==='idle'?'list':'run';
    render(focus);
  }
  function begin(skill) {
    if (running(state) && (skill ? state.mode==='practice'&&state.skill===skill : state.mode==='diagnostic')) {
      showState(engine().getState());return;
    }
    resetDraft();
    showState(skill?engine().startPractice(skill):engine().startDiagnostic());
  }
  function reorder(q, action, pos) {
    if (!Number.isInteger(pos) || pos<0) return;
    let focus;
    if (action==='add') {
      if (pos>=q.options.length || arranged.includes(pos)) return;
      arranged.push(pos);
      const next=q.options.findIndex((_,i)=>!arranged.includes(i));
      focus=next<0?'[type="submit"]':'[data-order-add="'+next+'"]';
    } else {
      if (pos>=arranged.length) return;
      const removed=arranged.splice(pos,1)[0];
      focus='[data-order-add="'+removed+'"]';
    }
    render(false);body.querySelector(focus)?.focus({preventScroll:true});
    live.textContent=arranged.length?'当前句子：'+arranged.map(i=>q.options[i]).join(' '):'已移回全部词块。';
  }
  function submit() {
    if (busy || page!=='run' || state.phase!=='question') return;
    const q=state.question;
    if (q.audioWord && !heard) {live.textContent='请先听一遍，可以重听。';return;}
    const raw=q.type==='choice'?selected:q.type==='order'?arranged.map(i=>q.options[i]):text.trim();
    if (raw===null || ((q.type==='text'||q.type==='order') && !raw.length)) {
      live.textContent=q.type==='choice'?'先选一个答案。':q.type==='order'?'先选择词块组成一句话。':'先写下你的答案。';
      body.querySelector('input, [data-order-add]')?.focus();return;
    }
    if (q.type==='order' && raw.length!==q.options.length) {
      live.textContent='还差 '+(q.options.length-raw.length)+' 个词块，放进句子后再提交。';
      body.querySelector('[data-order-add]:not(:disabled)')?.focus();return;
    }
    busy=true;
    try {
      stopAudio();
      const next=engine().answer(raw);
      showState(next);
      if (next.feedback?.kind==='empty') live.textContent=next.feedback.explain;
    }
    finally {busy=false;}
  }
  async function listen() {
    if (state.phase!=='question' || !state.question?.audioWord) return;
    if (playing) {stopAudio();render(false);body.querySelector('[data-ec="audio"]')?.focus();return;}
    const recording=state.question.audioWord, ticket=++playId, currentKey=draftKey;
    playing=true;
    const playButton=body.querySelector('[data-ec="audio"]');
    playButton.textContent='停止播放';playButton.setAttribute('aria-pressed','true');
    body.querySelector('.ec-audio-note').textContent='正在播放…';
    let success=false;
    try {success=await window.WordAudio?.play(recording);}
    catch (_) { /* An unavailable audio device is explicitly ungraded. */ }
    if (ticket!==playId || draftKey!==currentKey || page!=='run' || !dialog.open || state.phase!=='question') return;
    playing=false;heard=Boolean(success)||heard;
    playButton.textContent=heard?'重听录音':'播放录音';playButton.setAttribute('aria-pressed','false');
    body.querySelector('.ec-audio-note').textContent=success?'已播放，可以作答。':'没有听清？可以重播，也可选择换一题。';
    if (heard) body.querySelectorAll('[type="submit"],[data-ec="skip"]').forEach(b=>{b.disabled=false;});
  }

  dialog.addEventListener('click',event=>{
    const b=event.target.closest('button');
    if (!b || b.disabled || busy) return;
    if (b.hasAttribute('data-order-add') || b.hasAttribute('data-order-drop')) {
      if (page==='run' && state.phase==='question' && state.question?.type==='order') {
        if (b.hasAttribute('data-order-add')) reorder(state.question,'add',Number(b.dataset.orderAdd));
        else reorder(state.question,'drop',Number(b.dataset.orderDrop));
      }
      return;
    }
    const cmd=b.dataset.ec;
    if (!cmd) return;
    if (['close','journal','exam'].includes(cmd)) {nextDialog=cmd;stopAudio();dialog.close();return;}
    if (cmd==='list') {stopAudio();page='list';state=engine().getState();render();return;}
    if (cmd==='resume') {showState(engine().getState());return;}
    if (cmd==='diagnostic') {begin(null);return;}
    if (cmd.startsWith('practice-') && validSkill(cmd.slice(9))) {begin(cmd.slice(9));return;}
    if (cmd==='next' && state.phase==='feedback') {stopAudio();showState(engine().next());return;}
    if (cmd==='audio') {listen();return;}
    if (page==='run' && state.phase==='question' && (cmd==='skip'||cmd==='unavailable')) {
      if (cmd==='unavailable'&&!state.question.audioWord) return;
      if (cmd==='skip'&&state.question.audioWord&&!heard) return;
      stopAudio();showState(cmd==='unavailable'?engine().skip('audio-unavailable'):engine().skip());
    }
  });
  dialog.addEventListener('input',e=>{if (e.target.hasAttribute('data-ec-text')) text=e.target.value;});
  dialog.addEventListener('change',e=>{if (e.target.hasAttribute('data-ec-choice')) selected=Number(e.target.dataset.ecChoice);});
  dialog.addEventListener('submit',e=>{e.preventDefault();submit();});
  dialog.addEventListener('close',()=>{
    if (dialog.open) return;
    stopAudio();const target=opener, destination=nextDialog;opener=null;nextDialog='';
    if (destination==='exam' && window.ExamBridge?.open) window.ExamBridge.open(target);
    else if (destination==='journal' && window.LearnJournal?.open) window.LearnJournal.open(target);
    else if (target?.isConnected) target.focus({preventScroll:true});
  });
  window.addEventListener('pagehide',stopAudio);
  document.addEventListener('visibilitychange',()=>{if (document.hidden && playing) {
    stopAudio();if (dialog.open && page==='run') render(false);
  }});
  function open(trigger,skillId) {
    if (!engine()) return;
    if (!dialog.open) {opener=trigger?.focus?trigger:document.activeElement;nextDialog='';dialog.showModal();}
    window.LearnVoice?.stop();window.Phonics?.stop();stopAudio();
    state=engine().getState();
    if (skillId==='diagnostic') {begin(null);return;}
    if (validSkill(skillId)) {begin(skillId);return;}
    page='list';render();
  }
  window.EnglishCheckUI=Object.freeze({open});
})();

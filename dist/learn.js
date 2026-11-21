/* Study is the front door. The city, shop and island map are optional destinations. */
(() => {
  'use strict';
  const home = document.getElementById('learn-home');
  const round = window.LearnRound;
  const game = window.Game;
  if (!home || !round || !game) return;

  const subjects = window.LEARNING_CONTENT.subjects;
  const subjectArt = {english:'art/english.png', geography:'art/geography.png', history:'art/history.png', chinese:'art/chinese.png'};
  const landscapes = {english:'art/forest.png', geography:'art/harbor.png', history:'art/ruins.png', chinese:'art/academy.png'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId = new Map(window.LEARNING_CONTENT.missions.map(m=>[m.id,m]));
  let state = null, response = null, busy = false, walletMarkup = '';

  home.innerHTML = '<header class="lh-bar"><div class="lh-width lh-bar-inner"><div class="lh-brand">'+
    '<img src="art/logo.png" width="36" height="36" alt=""><b>快乐学</b><span>七年级上册</span></div>'+
    '<div class="lh-profile"><div class="lh-wallet" aria-label="学习等级与金币"></div>'+
    '<button class="lh-dress" type="button" data-learn="dress"><img alt="" src="art/avatar.png"><span>换装</span></button>'+
    '<button class="lh-medals" type="button" data-learn="medals"><span aria-hidden="true">✦</span> 勋章</button></div></div></header>'+
    '<div class="lh-width lh-main"><section class="lh-heading" aria-labelledby="lh-title"><div class="lh-titleline"><h1 id="lh-title">英语闯关</h1><span class="lh-round-size">每轮 3 题</span><button type="button" class="lh-vocab-entry" data-learn="vocab"><img alt="" src="art/english.png"><span><b>单词练习</b><small>3 词一组 · 听音拼词</small></span></button></div>'+
    '<nav class="lh-filters" aria-label="选择学习科目">'+
    '<button class="lh-english-track" type="button" data-scope="english"><img alt="" src="art/english.png"><span>英语主线</span></button>'+
    subjects.filter(s=>s.id!=='english').map(s=>'<button type="button" data-scope="'+esc(s.id)+'"><img alt="" src="'+subjectArt[s.id]+'">'+esc(s.name)+'</button>').join('')+
    '<button type="button" data-scope="all"><i class="lh-four" aria-hidden="true"></i>四科轮练</button>'+
    '</nav></section><div class="lh-workspace"><section id="learn-trail-inline"></section><section class="lh-page" aria-label="当前学习任务"></section></div>'+
    '<nav class="lh-extra" aria-label="其他活动"><button type="button" data-learn="hub">群岛探险</button><span aria-hidden="true">·</span>'+
    '<button type="button" data-learn="city">日落港</button><span aria-hidden="true">·</span><button type="button" data-learn="shop">道具商店</button></nav>'+
    '</div><div class="lh-sr" aria-live="polite" aria-atomic="true" id="lh-live"></div>';
  const panel = home.querySelector('.lh-page');
  const wallet = home.querySelector('.lh-wallet');
  const live = home.querySelector('#lh-live');
  const trail = home.querySelector('#learn-trail-inline');
  const sizeIndicator = home.querySelector('.lh-round-size');
  const pageTitle = home.querySelector('#lh-title');
  const englishLabel = home.querySelector('.lh-english-track span');
  const vocabButton=home.querySelector('.lh-vocab-entry');
  function updateVocabEntry() {
    const api=window.WordPractice;
    vocabButton.hidden=!window.WordPracticeUI || state?.subject!=='english';
    if(vocabButton.hidden||!api)return;
    const due=api.stats('primary').due+api.stats('junior').due;
    const copy=due?due+' 个词待复习':'3 词一组 · 听音拼词';
    const detail=vocabButton.querySelector('small');
    if(detail.textContent!==copy)detail.textContent=copy;
  }
  const dress = home.querySelector('[data-learn="dress"]');
  function updateOutfit(value=window.LearnWardrobe?.avatar?.()) {
    if(!value?.src || !dress) return;
    dress.querySelector('img').src=value.src;
    dress.setAttribute('aria-label','换装，当前为'+(value.name||'探险服'));
  }
  const topicName = q => window.LearnFacts?.[q.id]?.topic || q.title || '';
  function scopeForTrail(s){
    return s.subject==='all'?(s.question?.subject || s.knowledge?.[0]?.subject || 'english'):s.subject;
  }


  function updateWallet() {
    const s=game.getState();
    const html='<span class="lh-lvl">Lv. '+esc(s.level)+'</span><span class="lh-wallet-divider"></span>'+
      '<span class="lh-coins"><i aria-hidden="true"></i>'+esc(s.coins)+' <small>金币</small></span>';
    if(html!==walletMarkup){walletMarkup=html;wallet.innerHTML=html;}
  }
  function header(s) {
    const q=s.question, review=s.mode==='review' && s.phase!=='complete';
    const total=review?s.reviewTotal:s.roundSize, pos=s.phase==='complete'?total:s.position;
    const count=Math.max(1,total);
    const done=s.phase==='complete'?count:Math.max(0,pos-1)+(s.phase==='feedback'?1:0);
    const label=s.phase==='complete'?'完成':review?'回想练习':s.topicId?'知识点挑战':'本轮进度';
    const parts=Math.min(count,5);
    const filled=Math.floor(done/count*parts);
    const bits=Array.from({length:parts},(_,i)=>'<i class="'+(i<filled?'lh-done':i===filled?'lh-now':'')+'"></i>').join('');
    const subject=q?.subjectName || s.subjectName;
    const icon = q && subjectArt[q.subject] ? '<img alt="" src="'+subjectArt[q.subject]+'">' : '<img alt="" src="art/logo.png">';
    const topic=q?topicName(q):'本轮知识卡';
    const number=q?window.LEARNING_CONTENT.missions.filter(m=>m.subject===q.subject).findIndex(m=>m.id===q.id)+1:0;
    const category=String(subject)+(number>0?' · 第 '+number+' 关':'');
    return '<div class="lh-pagehead"><div class="lh-subject">'+icon+'<span><small>'+esc(category)+'</small><b>'+esc(topic)+'</b></span></div>'+
      '<div class="lh-count"><span>'+label+'</span><div class="lh-segments" aria-hidden="true">'+bits+'</div><b>'+esc(pos)+' / '+esc(count)+'</b></div></div>';
  }

  function clue(q,review) {
    if(review || !q.clue) return '';
    const picture=landscapes[q.subject] || landscapes.english;
    const example=q.subject==='english'?window.LearnFacts?.[q.id]?.model:null;
    const hasModel=Boolean(example?.en && example?.zh);
    const listen=hasModel?'<span class="lh-model-audio" data-lh-voice>可照着范句跟读</span>':'';
    const compact=hasModel?'<details class="lh-short-note"><summary>展开点拨</summary><p>'+esc(q.clue)+'</p></details>':'';
    const model=hasModel?'<div class="lh-model"><strong lang="en" id="lh-model-text">'+esc(example.en)+'</strong>'+
      '<span lang="zh-CN">'+esc(example.zh)+'</span></div>':'';
    return '<aside class="lh-clue'+(hasModel?' lh-with-model':'')+'" aria-labelledby="lh-clue-label"><div class="lh-clue-copy">'+
      '<div class="lh-clue-top"><b class="lh-clue-label" id="lh-clue-label"><img src="art/sprite.png" alt="" width="26" height="26">阿芽的线索</b>'+listen+'</div>'+
      '<p class="lh-rule">'+esc(q.clue)+'</p>'+model+compact+'</div><div class="lh-scenery" aria-hidden="true"><img alt="" src="'+picture+'"></div></aside>';
  }
  function mountVoice() {
    if(home.hidden || !state || state.mode==='review' || state.phase!=='question' || state.question?.subject!=='english')return;
    const host=panel.querySelector('[data-lh-voice]');
    if(host)window.LearnVoice?.mountModel(host,state.question.id);
  }
  function questionField(s) {
    const q=s.question, correct=s.phase==='feedback',review=s.mode==='review';
    const wrong=Array.isArray(q.wrong)?q.wrong:[];
    const prompt='<h2 class="lh-question" id="lh-question" tabindex="-1">'+esc(q.prompt)+'</h2>';
    if(correct) {
      const index=q.selected;
      const choice=Number.isInteger(index)?q.options[index]:null;
      const pass=response?.passedNow?'<div class="lh-pass"><img src="art/logo.png" width="24" height="24" alt=""><span>过关啦！</span><b>'+esc(topicName(q))+'</b></div>':'';
      const nextLabel=s.needsIndependent?'独立再试一次':s.nextMode==='review'?'去做回想题':s.nextMode==='learn'?'下一题':s.topicId?'查看通关记录':'查看本轮记录';
      const retryNote=s.needsIndependent?'<p class="lh-retry-note">下一题换个说法，再独立试一次。</p>':'';
      const resultNote = response?.correct && response.rewarded ?
        '<span class="lh-smallreward">＋'+esc(response.xpGain)+' XP · ＋'+esc(response.coinGain)+' 币</span>' : '';
      return '<div class="lh-content">'+pass+prompt+'<div class="lh-answer-good"><b><span class="lh-check" aria-hidden="true">✓</span>'+
        esc(choice || '回答正确')+'</b><p>'+esc(q.explain)+'</p>'+retryNote+'</div><div class="lh-nextline">'+
        '<button class="lh-primary" type="button" data-learn="next">'+
        nextLabel+'</button>'+resultNote+'</div>'+(q.subject==='english'?'<div data-english-build></div>':'')+'</div>';
    }
    const choices=q.options.map((option,i)=>{
      const spent=q.eliminated===i,tried=wrong.includes(i), mark=spent?'灵感卡已排除':tried?'已试过':'';
      return '<button type="button" class="lh-answer" data-learn="answer" data-value="'+i+'" aria-keyshortcuts="'+(i+1)+' '+String.fromCharCode(65+i)+'"'+(mark?' disabled':'')+'>'+
        '<span class="lh-key" aria-hidden="true">'+String.fromCharCode(65+i)+'</span><span>'+esc(option)+'</span>'+
        (mark?'<small>'+mark+'</small>':'')+'</button>';
    }).join('');
    const help=q.showHint?'<div class="lh-hint"><b>'+ (wrong.length?'换个角度':'小提示')+'</b><span>'+esc(q.hint)+'</span></div>':'';
    const hintTool=!q.showHint?'<button type="button" data-learn="hint">给我一点提示</button>':'';
    const insight=q.canUseInsight && !review?'<button type="button" data-learn="insight">用灵感卡</button>':'';
    const tools=hintTool||insight?'<div class="lh-tools">'+hintTool+insight+'</div>':'';
    return '<div class="lh-content">'+clue(q,review)+prompt+help+
      '<div class="lh-answers" role="group" aria-labelledby="lh-question">'+choices+'</div>'+tools+'</div>';
  }

  function summaryEntries(s) {
    const entries=s.summary || s.knowledge || [];
    return entries.map(entry=>{
      const m=typeof entry==='string'?byId.get(entry):byId.get(entry.id);
      return {
        id:typeof entry==='string'?entry:entry.id,
        text:typeof entry==='string'?m?.memory:entry.lesson || entry.memory || m?.memory,
        subject:(typeof entry==='string'?null:entry.subject)||m?.subject
      };
    }).filter(e=>e.text&&subjectArt[e.subject]);
  }

  function complete(s) {
    const entries=summaryEntries(s);
    const memory=entries.length?'<ul class="lh-takeaways">'+entries.map(e=>{
      const name=subjects.find(v=>v.id===e.subject)?.name || '';
      const recovered=(s.recoveredIds||[]).includes(e.id)?'<small>已回想</small>':'';
      const topic=window.LearnFacts?.[e.id]?.topic || byId.get(e.id)?.title || name;
      return '<li><img src="'+subjectArt[e.subject]+'" alt="'+esc(name)+'"><div><b>'+esc(topic)+'</b>'+recovered+'<p>'+esc(e.text)+'</p></div></li>';
    }).join('')+'</ul>':'';
    const recovered=Number(s.recovered)||0;
    const nextPoint=s.topicId && round.getTopicProgress?.().bySubject?.[s.subject]?.some(t=>t.status==='current');
    const continueLabel=s.topicId?(nextPoint?'下一关':'复习本学科'):'再学一轮';
    return '<div class="lh-content lh-finished"><img class="lh-trophy" src="art/treasure.png" width="62" height="62" alt="">'+
      '<h2 class="lh-question" id="lh-question" tabindex="-1">'+(s.topicId?'这一关学会了！':'这一轮学完了！')+'</h2>'+
      (recovered?'<p class="lh-recovered">刚才拿不准的 '+esc(recovered)+' 个知识点，你在新场景里用对了。</p>':'')+
      memory+'<div class="lh-nextline"><button class="lh-primary" type="button" data-learn="new">'+continueLabel+'</button>'+
      (s.roundXp||s.roundCoins?'<span class="lh-smallreward">本轮 ＋'+esc(s.roundXp)+' XP · ＋'+esc(s.roundCoins)+' 币</span>':'')+'</div></div>';
  }

  function render(snapshot = round.getState()) {
    window.LearnVoice?.stop();
    state=snapshot;updateWallet();updateVocabEntry();
    const scope=safescope(snapshot.subject);
    pageTitle.textContent=scope==='all'?'四科轮练':(subjects.find(s=>s.id===scope)?.name || '英语')+'闯关';
    englishLabel.textContent=scope==='english'?'英语主线':'继续英语';
    sizeIndicator.textContent=snapshot.topicId?'知识点挑战':snapshot.roundSize===3?'每轮 3 题':'本轮 '+snapshot.roundSize+' 题';
    for(const button of home.querySelectorAll('[data-scope]')) button.setAttribute('aria-pressed',String(button.dataset.scope===safescope(snapshot.subject)));
    panel.innerHTML=header(snapshot)+(snapshot.phase==='complete'?complete(snapshot):questionField(snapshot));
    mountVoice();
    const builder=panel.querySelector('[data-english-build]');
    if(builder)window.EnglishBuild?.mount?.(builder,snapshot.question.id);
    window.LearnTrail?.mountInline?.(trail,scopeForTrail(snapshot));
  }
  function safescope(scope) {return subjects.some(s=>s.id===scope)?scope:'all';}
  function focusQuestion(preferInsight=false) {
    if(home.hidden)return false;
    const target=(preferInsight && panel.querySelector('[data-learn="insight"]:not(:disabled)')) ||
      panel.querySelector('[data-learn="new"],[data-learn="next"]') || panel.querySelector('#lh-question');
    if(!target)return false;
    target.focus({preventScroll:true});
    target.scrollIntoView?.({block:'nearest',behavior:'instant'});
    return true;
  }
  function focusNextChoice() {
    const choice=panel.querySelector('.lh-answer:not(:disabled)');
    choice?.focus({preventScroll:true});
  }
  function announce(text) {
    live.textContent=text;
  }
  function doLearning(key,value) {
    if(busy || home.hidden)return;
    if(['hub','city','shop','dress','medals','vocab'].includes(key))window.LearnVoice?.stop();
    busy=true;
    try {
      if(key==='answer') {
        if(state.phase!=='question')return;
        const index=Number(value),q=state.question;
        if(!Number.isInteger(index)||index<0||index>=q.options.length||q.wrong.includes(index)||q.eliminated===index)return;
        response=round.answer(index);
        render(response.state || round.getState());
        if(!response.ok){announce(response.message || '请再试一次。');return;}
        if(response.correct){announce((response.passedNow?'知识点通关！':'答对了。')+state.question.explain);focusQuestion();}
        else{announce('再想一想。'+state.question.hint);focusNextChoice();}
      } else if(key==='next' || key==='new') {
        response=null;render(key==='new'?round.nextRound():round.next());
        announce(state.phase==='complete'?'本轮完成。':state.mode==='review'?'进入回想练习。':'下一题。');focusQuestion();
      } else if(key==='hint') {
        render(round.hint());announce(state.question.hint);focusNextChoice();
      } else if(key==='insight') {
        if(!state.question?.canUseInsight)return;
        const used=round.useInsight();render(used.state || round.getState());
        announce(used.message || '已排除一个选项。');focusNextChoice();
      } else if(key==='hub') window.LearnRoutes?.openHub();
      else if(key==='city') window.LearnRoutes?.openCity();
      else if(key==='shop') window.HarborShop?.open('shop');
      else if(key==='vocab') window.WordPracticeUI?.open(vocabButton);
      else if(key==='dress') window.LearnWardrobe?.open?.(dress);
      else if(key==='medals') window.LearnTrail?.openMedals?.(home.querySelector('[data-learn="medals"]'));
    } finally {busy=false;}
  }
  home.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b||!home.contains(b)||b.disabled)return;
    if(b.hasAttribute('data-scope')){
      if(b.dataset.scope===state.subject && !state.topicId)return;
      response=null;
      render(round.selectSubject(b.dataset.scope));announce('已切换到'+state.subjectName+'。');focusQuestion();return;
    }
    if(b.dataset.learn)doLearning(b.dataset.learn,b.dataset.value);
  });
  window.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.repeat||e.isComposing||home.hidden||e.altKey||e.ctrlKey||e.metaKey||
       state?.phase!=='question'||document.querySelector('dialog[open]')||e.target?.isContentEditable||
       /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName))return;
    const key=String(e.key).toLowerCase(), idx='abc'.indexOf(key);
    const index=key.length===1 && idx>=0 ? idx : /^[1-3]$/.test(key)?Number(key)-1:-1;
    if(index<0||index>=state.question.options.length)return;
    const choice=panel.querySelector('[data-learn="answer"][data-value="'+index+'"]:not(:disabled)');
    if(choice){e.preventDefault();choice.click();}
  });
  game.subscribe(()=>{if(!busy&&!home.hidden)updateWallet();});
  window.addEventListener('harbor-shop-visibility',e=>{
    if(e.detail?.open===true){window.LearnVoice?.stop();return;}
    if(e.detail?.open!==false||home.hidden)return;
    render();
  });
  window.addEventListener('learn-trail-topic',e=>{
    if(!e.detail?.ok||!e.detail.state)return;
    response=null;render(e.detail.state);announce('进入'+topicName(e.detail.state.question || {})+'。');focusQuestion();
  });
  window.addEventListener('learn-voice-ready',mountVoice);
  window.addEventListener('word-practice-ready',updateVocabEntry);
  window.addEventListener('vocab-progress',updateVocabEntry);
  window.addEventListener('learn-outfit-change',e=>updateOutfit(e.detail));
  window.LearnHome=Object.freeze({
    open(){home.hidden=false;render();},
    close(){window.LearnVoice?.stop();home.hidden=true;},
    focusQuestion
  });
  updateOutfit();render();
})();

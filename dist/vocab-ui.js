/* Three-word vocabulary sessions, a searchable local word bank, and optional pronunciation. */
(() => {
  'use strict';
  const dialog=document.getElementById('vocab-dialog'), practice=window.WordPractice;
  if(!dialog || !practice)return;
  const stages={primary:'小学起步',junior:'初中衔接'};
  const words=window.EnglishWords || [];
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const opposite='abcdefghijklmnopqrstuvwxyz';
  let state,pane='learn',opener=null,query='',draft='',showFirst=false,letters=[],chosen=[],fullKeyboard=false,busy=false;
  const btn=(key,label,primary=false)=>'<button type="button" class="vw-button'+(primary?' vw-primary':'')+'" data-word-act="'+key+'">'+label+'</button>';
  dialog.setAttribute('aria-labelledby','vocab-title');
  dialog.innerHTML='<header class="vw-head"><div class="vw-head-icon"><img src="art/english.png" alt=""></div><div><h2 id="vocab-title" tabindex="-1">单词练习</h2></div>'+
    '<button class="vw-x" type="button" data-word-act="close" aria-label="关闭单词练习">×</button></header>'+
    '<div class="vw-toolbar"><div class="vw-stages" role="group" aria-label="词汇学段">'+Object.entries(stages).map(([k,n])=>'<button type="button" data-word-stage="'+k+'">'+n+'</button>').join('')+
    '</div><button class="vw-library" type="button" data-word-act="toggle-bank">查词库</button></div>'+
    '<div class="vw-scroll"><div class="vw-body"></div></div><div class="vw-sr" aria-live="polite" id="vw-live"></div>';
  const body=dialog.querySelector('.vw-body'),scroll=dialog.querySelector('.vw-scroll'),live=dialog.querySelector('#vw-live');
  const libraryButton=dialog.querySelector('.vw-library');

  function queueChanged() {window.dispatchEvent(new CustomEvent('vocab-progress'));}
  function resetDraft() {draft='';letters=[];chosen=[];fullKeyboard=false;showFirst=false;}
  function loadStage(stage) {
    if(stage && stage!==state?.stage)state=practice.selectStage(stage);
    else state=practice.getState();
    if(pane==='learn'&&state.phase==='idle')state=practice.start();
  }
  function model(w){
    return '<div class="vw-study-card"><div class="vw-wordline"><strong class="vw-en" lang="en">'+escape(w.word)+'</strong><span class="vw-voice" data-vw-say="word"></span></div>'+
      '<p class="vw-definition">'+escape(w.zh)+'</p><div data-word-phonics></div><div class="vw-example"><div class="vw-example-line"><b>例句</b><span class="vw-voice" data-vw-say="example"></span></div>'+
      '<p lang="en">'+escape(w.example)+'</p><small>'+escape(w.translation)+'</small></div></div>';
  }
  function info(text,side='') {
    return '<div class="vw-info"><b>'+escape(text)+'</b>'+(side?'<span>'+escape(side)+'</span>':'')+'</div>';
  }
  function cloze(w) {
    const gap='<span class="vw-blank" aria-label="空格">_____</span>';
    return '<div class="vw-recall"><b>'+escape(w.zh)+'</b><p lang="en">'+escape(w.prompt).replace(/_+/g,gap)+'</p></div>';
  }
  function tiles() {
    const display=letters.map((l,i)=>'<button type="button" data-letter="'+i+'"'+(!fullKeyboard&&chosen.includes(i)?' disabled':'')+' aria-label="'+escape(l===' '?'空格':l)+'">'+escape(l===' '?'␣':l)+'</button>').join('');
    return '<div class="vw-keyboard'+(fullKeyboard?' vw-full':'')+'" role="group" aria-label="'+(fullKeyboard?'完整英文键盘':'备选字母')+'">'+display+'</div><div class="vw-letters-tools">'+
      btn('backspace','删一个字母')+btn('clear','清空')+'</div>';
  }
  function quiz() {
    const w=state.word;
    const guided=state.assisted?'<p class="vw-gentle">已用辅助。答对后，这个词还会回来让你独立拼一次。</p>':'';
    return info('收起词卡，试着拼写',w.theme)+cloze(w)+
      '<form class="vw-form"><label for="vw-answer">写出空格里的英文</label><div class="vw-entry"><input id="vw-answer" aria-label="拼写答案" name="answer" type="text" lang="en" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" autocorrect="off" maxlength="100" placeholder="输入英文" value="'+escape(draft)+'"'+(letters.length?' readonly':'')+'>'+
      '<button type="submit" class="vw-button vw-primary">核对</button></div></form>'+
      (showFirst?'<p class="vw-hint">首字母 <b lang="en">'+escape(w.word[0])+'</b></p>':'')+
      (letters.length?tiles():'')+
      '<div class="vw-help">'+(showFirst?'':btn('hint','看首字母'))+(letters.length?btn('typing','改用输入法'):btn('keyboard','点字母拼'))+(!letters.length||fullKeyboard?btn('letters','给我备选字母'):'')+btn('reveal','不会，再看一遍')+'</div>'+guided;
  }
  function feedback() {
    const f=state.feedback||{},w=state.word;
    const exposed=['correct','revealed','assisted'].includes(f.kind);
    const heading={correct:'独立拼对了！',assisted:'在提示下拼对了',revealed:'再认识一下',wrong:f.reason==='alternative'?'意思对了，换个词想想':'差一点，再找找线索',empty:'先试着写一个词'}[f.kind] || '继续练习';
    const reward=f.coinGain||f.xpGain?'<small class="vw-reward">＋'+escape(f.xpGain||0)+' XP · ＋'+escape(f.coinGain||0)+' 币</small>':'';
    const explain=!exposed&&f.kind==='wrong'?'<details class="vw-after-note"><summary>看看这个词怎么记</summary>'+model(w)+'</details>':'';
    return info(heading)+(exposed?model(w):cloze(w))+
      '<p class="vw-gentle">'+escape(f.message||'稍后再换个时机试试。')+'</p>'+explain+'<div class="vw-actions">'+btn('next','继续练习',true)+reward+'</div>';
  }
  function training(){
    const w=state.word,group=state.roundWords||[];
    if(state.phase==='complete'){
      return info('这组练完了','每组练习会优先安排到期的词')+'<div class="vw-done"><img src="art/treasure.png" alt=""><h3 tabindex="-1" id="vw-focus">记下这 '+escape(state.roundSize||group.length)+' 个词</h3></div>'+
        '<ul class="vw-recap">'+group.map(item=>typeof item==='string'?words.find(x=>x.word===item&&x.stage===state.stage):item).filter(Boolean).map(item=>'<li><b lang="en">'+escape(item.word)+'</b><span>'+escape(item.zh)+'</span></li>').join('')+'</ul>'+
        '<div class="vw-actions">'+btn('start','学下一组',true)+btn('journal','今天的知识讲解')+btn('bank','看看词库')+'</div>';
    }
    if(!w) return '<div class="vw-actions">'+btn('start','开始学词',true)+'</div>';
    if(state.phase==='study'){
      return info('先看词卡',String(state.position)+' / '+String(state.roundSize))+
        model(w)+'<div class="vw-actions">'+btn('next',state.position<state.roundSize?'看下一个词':'收起词卡，开始回想',true)+'</div>';
    }
    return state.phase==='quiz'?quiz():feedback();
  }
  const statusLabel={unseen:'新词',practiced:'已练习',due:'待复习'};
  function updateList() {
    const list=body.querySelector('.vw-results'),count=body.querySelector('.vw-resultcount');
    if(!list)return;
    const term=query.trim().toLowerCase(), activeQuiz=state.phase==='quiz'||(state.phase==='feedback'&&['wrong','empty'].includes(state.feedback?.kind));
    // Keep the current closed-book answer out of the library while it is being recalled.
    const filtered=words.filter(w=>w.stage===state.stage && (!activeQuiz || w.word!==state.word?.word) &&
      (!term||[w.word,w.zh,w.theme].some(v=>String(v).toLowerCase().includes(term))));
    count.textContent=filtered.length+' 个词';
    list.innerHTML=filtered.length?filtered.map(w=>{
      const status=practice.wordStatus?.(w.word,w.stage)||'unseen';
      return '<li><button type="button" data-word-pick="'+escape(w.word)+'" aria-label="学习 '+escape(w.word)+'"><span><b lang="en">'+escape(w.word)+'</b><small>'+escape(w.zh)+'</small></span><span class="vw-word-status '+(status==='due'?'is-due':'')+'">'+(statusLabel[status]||'新词')+'</span></button></li>';
    }).join(''):'<li class="vw-empty">没有找到这个词，可换个英文、中文或主题试试。</li>';
  }
  function bank(){
    const stats=practice.stats(state.stage);
    return info(stages[state.stage]+'词库','已练 '+stats.practiced+' · 待复习 '+stats.due)+
      '<label class="vw-search"><span>查找单词</span><input type="search" data-vw-search maxlength="80" value="'+escape(query)+'" placeholder="英文、中文或主题"></label>'+
      '<div class="vw-listline"><span class="vw-resultcount"></span>'+
      (state.phase==='quiz'?'<small>当前回想词暂时收起</small>':'')+'</div><ul class="vw-results" aria-label="词库搜索结果"></ul>';
  }
  function render(focus=false) {
    if(!dialog.open)return;
    window.LearnVoice?.stop();window.Phonics?.stop?.();
    dialog.querySelectorAll('[data-word-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordStage===state.stage)));
    libraryButton.textContent=pane==='bank'?'回到练习':'查词库';
    libraryButton.setAttribute('aria-label',libraryButton.textContent);
    body.innerHTML=pane==='bank'?bank():training();
    if(pane==='bank')updateList();
    else body.querySelectorAll('[data-vw-say]').forEach(host=>window.LearnVoice?.mountWord?.(host,state.word.word,host.dataset.vwSay));
    const phonics=body.querySelector('[data-word-phonics]');
    if(phonics&&pane==='learn')window.Phonics?.mount?.(phonics,state.word.word);
    if(focus) {
      const el=pane==='bank'?body.querySelector('[data-vw-search]'):
        body.querySelector('#vw-focus,.vw-info b,.vw-info');
      if(el){if(el.tagName!=='INPUT')el.tabIndex=-1;el.focus({preventScroll:true});}
      scroll.scrollTop=0;
    }
  }
  function open(openerArg,stage){
    const already=dialog.open;
    if(!already){opener=openerArg?.focus?openerArg:document.activeElement;pane='learn';query='';resetDraft();dialog.showModal();}
    loadStage(stage in stages?stage:null);render(true);
    if(!already)window.dispatchEvent(new CustomEvent('vocab-visibility',{detail:{open:true}}));
    queueChanged();
  }
  function goNext(key){
    if(key==='start')state=practice.start();else state=practice.next();
    resetDraft();render(true);queueChanged();
  }
  function makeLetters(word){
    const expected=Array.from(word.toLowerCase()),choices=[...expected];
    const distractors=Array.from(opposite).filter(c=>!expected.includes(c));
    for(let i=0;i<2&&distractors.length;i++)choices.push(distractors.splice(Math.floor(Math.random()*distractors.length),1)[0]);
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    if(expected.length>1&&choices.join('').includes(expected.join(''))){
      const first=choices.indexOf(expected[0]),other=choices.findIndex(c=>!expected.includes(c));
      if(other>=0)[choices[first],choices[other]]=[choices[other],choices[first]];
    }
    return choices;
  }
  function tileUpdate(lastKey) {
    draft=chosen.map(i=>letters[i]).join('');
    const input=body.querySelector('#vw-answer');if(input)input.value=draft;
    body.querySelectorAll('[data-letter]').forEach(b=>{b.disabled=!fullKeyboard&&chosen.includes(Number(b.dataset.letter));});
    live.textContent=draft ? '已拼 '+[...draft].join(' ') : '已清空';
    if(lastKey==='delete')body.querySelector('[data-word-act="backspace"]')?.focus({preventScroll:true});
  }
  function submit(){
    if(busy||pane!=='learn'||state.phase!=='quiz')return;
    const text=body.querySelector('#vw-answer')?.value?.trim()||'';
    if(!text){live.textContent='先输入英文，或点字母拼。';body.querySelector('#vw-answer')?.focus();return;}
    busy=true;
    try{state=practice.answer(text);resetDraft();render(true);live.textContent=state.feedback?.message||'';queueChanged();}
    finally{busy=false;}
  }
  dialog.addEventListener('input',e=>{
    if(e.target.hasAttribute('data-vw-search')){query=e.target.value;updateList();}
    else if(e.target.id==='vw-answer')draft=e.target.value;
  });
  dialog.addEventListener('submit',e=>{e.preventDefault();submit();});
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||busy||!dialog.contains(b))return;
    if(b.hasAttribute('data-word-stage')){
      const target=b.dataset.wordStage;if(target===state.stage)return;
      query='';resetDraft();loadStage(target);render();queueChanged();return;
    }
    if(b.hasAttribute('data-word-pick')){
      const w=b.dataset.wordPick;state=practice.focusWord(w,state.stage);pane='learn';query='';resetDraft();render(true);queueChanged();return;
    }
    if(b.hasAttribute('data-letter')){
      const idx=Number(b.dataset.letter);if(state.phase!=='quiz'||!letters[idx]||(!fullKeyboard&&chosen.includes(idx))||chosen.length>=100)return;
      chosen.push(idx);tileUpdate('add');return;
    }
    const k=b.dataset.wordAct;if(!k)return;
    if(k==='close'){dialog.close();return;}
    if(k==='journal'){
      const target=opener;dialog.close();window.LearnJournal?.open(target);return;
    }
    if(k==='toggle-bank'||k==='bank'){
      pane=k==='bank'||pane==='learn'?'bank':'learn';query='';
      render(true);return;
    }
    if(k==='next'||k==='start'){goNext(k);return;}
    if(state.phase!=='quiz')return;
    if(k==='keyboard'){
      fullKeyboard=true;letters=Array.from("qwertyuiopasdfghjklzxcvbnm-' ");chosen=[];draft='';
      render();live.textContent='完整字母键盘。可以重复点选同一个字母。';
      body.querySelector('[data-letter]')?.focus({preventScroll:true});return;
    }
    if(k==='hint'||k==='letters'){
      state=practice.hint();
      if(k==='letters'){fullKeyboard=false;letters=makeLetters(state.word.word);chosen=[];draft='';}
      else showFirst=true;
      render();live.textContent=k==='letters'?'可依次点选字母。':'首字母是 '+state.word.word[0];
      (body.querySelector('[data-letter]')||body.querySelector('#vw-answer'))?.focus({preventScroll:true});return;
    }
    if(k==='typing'){fullKeyboard=false;letters=[];chosen=[];render();body.querySelector('#vw-answer')?.focus();return;}
    if(k==='backspace'){chosen.pop();tileUpdate('delete');return;}
    if(k==='clear'){chosen=[];tileUpdate('clear');return;}
    if(k==='reveal'){state=practice.reveal();resetDraft();render(true);queueChanged();}
  });
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    window.LearnVoice?.stop();window.Phonics?.stop?.();resetDraft();
    window.dispatchEvent(new CustomEvent('vocab-visibility',{detail:{open:false}}));queueChanged();
    if(opener?.isConnected&&!opener.closest?.('[hidden],dialog:not([open])'))opener.focus({preventScroll:true});
    opener=null;
  });
  window.addEventListener('learn-voice-ready',()=>{if(dialog.open)render();});
  window.WordPracticeUI=Object.freeze({open});
  window.dispatchEvent(new CustomEvent('word-practice-ready'));
})();

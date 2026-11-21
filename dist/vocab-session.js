/* Offline word cards. Payments are made only by the shared game wallet. */
(() => {
  'use strict';
  const words=Array.isArray(window.EnglishWords)?window.EnglishWords:[];
  const stages=['primary','junior'], intervals=[1,3,7,14];
  const key='happylearn.vocabulary.practice.v1';
  const normalize=s=>typeof s==='string'?s.normalize('NFKC').trim().toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' '):'';
  const lists=Object.fromEntries(stages.map(s=>[s,new Map(words.filter(w=>w.stage===s&&normalize(w.word)).map(w=>[normalize(w.word),w]))]));
  const emptyCourse=()=>({records:{},blockedWord:null,round:null,suspended:null});
  const blank=()=>({stage:'primary',courses:{primary:emptyCourse(),junior:emptyCourse()}});
  let state=blank(),lastRaw=null,canStore=true,settling=false;
  function day(offset=0){
    const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,12);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
  const count=v=>Number.isSafeInteger(v)&&v>=0?v:0;
  const validStage=s=>stages.includes(s);
  const current=()=>state.courses[state.stage];
  const item=id=>lists[state.stage].get(id);
  const distinct=values=>[...new Set(values)];
  const feedbackKinds=['correct','wrong','revealed','assisted'];
  function restoreRound(raw,available){
    if(!raw||!Array.isArray(raw.words)||!Array.isArray(raw.done)||!Array.isArray(raw.steps))return null;
    const ids=distinct(raw.words.filter(id=>available.has(id)));
    if(!ids.length||ids.length>3||ids.length!==raw.words.length||raw.steps.length>9)return null;
    if(raw.steps.some(s=>!s||!['study','quiz','bridge'].includes(s.kind)||!available.has(s.id)||(s.kind!=='bridge'&&!ids.includes(s.id))))return null;
    const done=distinct(raw.done.filter(id=>ids.includes(id)));
    if(!raw.steps.length&&done.length!==ids.length)return null;
    if(ids.some(id=>!done.includes(id)&&!raw.steps.some(s=>s.id===id&&s.kind==='quiz')))return null;
    const first=raw.steps[0];
    const feedback=first&&feedbackKinds.includes(raw.feedback?.kind)?raw.feedback:null;
    const pending=raw.pending&&first?.kind==='quiz'&&first.id===raw.pending.id&&validDay(raw.pending.day)&&typeof raw.pending.answer==='string'?raw.pending:null;
    return {words:ids,steps:raw.steps,done,assisted:!!raw.assisted,feedback,pending,
      focus:!!raw.focus,xp:count(raw.xp),coins:count(raw.coins)};
  }
  function load(){
    if(!canStore)return;
    let raw;
    try{raw=localStorage.getItem(key);}catch{canStore=false;return;}
    if(raw===lastRaw)return;
    lastRaw=raw;
    const restored=blank();
    try{
      const saved=JSON.parse(raw)||{};
      if(validStage(saved.stage))restored.stage=saved.stage;
      for(const s of stages){
        const old=saved.courses?.[s],course=restored.courses[s];if(!old)continue;
        for(const id of lists[s].keys()){
          const v=old.records?.[id];if(!v||typeof v!=='object')continue;
          course.records[id]={lastDay:validDay(v.lastDay)?v.lastDay:null,due:validDay(v.due)?v.due:null,
            level:Math.min(intervals.length,count(v.level)),errors:count(v.errors),weak:!!v.weak};
        }
        course.blockedWord=lists[s].has(old.blockedWord)?old.blockedWord:null;
        course.round=restoreRound(old.round,lists[s]);course.suspended=restoreRound(old.suspended,lists[s]);
      }
    }catch{/* Recover a malformed vocabulary save without touching the learning wallet. */}
    state=restored;
  }
  function save(){
    if(!canStore)return;
    try{const raw=JSON.stringify(state);localStorage.setItem(key,raw);lastRaw=raw;}
    catch{canStore=false;}
  }
  function record(id){
    const c=current();return c.records[id]||(c.records[id]={lastDay:null,due:null,level:0,errors:0,weak:false});
  }
  function category(course,id,today){
    const r=course.records[id];return !r?'unseen':r.weak||r.due&&r.due<=today?'due':'practiced';
  }
  function stats(stage=state.stage){
    load();const s=validStage(stage)?stage:state.stage,c=state.courses[s],today=day();
    let unseen=0,due=0;
    for(const id of lists[s].keys()){
      const condition=category(c,id,today);
      if(condition==='unseen')unseen++;if(condition==='due')due++;
    }
    return {total:lists[s].size,unseen,practiced:lists[s].size-unseen,due};
  }
  function wordStatus(word,stage){
    load();const s=validStage(stage)?stage:state.stage;
    return category(state.courses[s],normalize(typeof word==='object'?word?.word:word),day());
  }
  function sortedWords(){
    const c=current(),today=day();
    const rank=id=>{
      const r=c.records[id];
      if(r?.weak)return 0;
      if(r?.due&&r.due<=today)return 1;
      if(r&&!r.lastDay)return 2;
      return r?4:3;
    };
    return [...lists[state.stage].keys()].sort((a,b)=>{
      const d=rank(a)-rank(b);if(d)return d;
      const one=c.records[a],two=c.records[b];
      return (one?.due||'').localeCompare(two?.due||'')||(two?.errors||0)-(one?.errors||0);
    });
  }
  function newRound(focus){
    const c=current(),ids=distinct(focus?[focus,...sortedWords()]:sortedWords()).slice(0,3);
    if(!ids.length)return null;
    const fresh=ids.filter(id=>!c.records[id]),known=ids.filter(id=>!!c.records[id]);
    const steps=[],add=(kind,id)=>steps.push({kind,id});
    if(focus&&fresh.includes(focus)){add('study',focus);fresh.shift();}
    if(known.length)add('quiz',known.shift());
    for(const id of fresh)add('study',id);
    for(const id of known)add('quiz',id);
    if(focus&&!c.records[focus])add('quiz',focus);
    for(const id of fresh)add('quiz',id);
    if(steps[0].kind==='quiz'&&steps[0].id===c.blockedWord){
      const other=steps.findIndex(s=>s.id!==c.blockedWord);
      if(other>0)steps.unshift(steps.splice(other,1)[0]);
    }
    return {words:ids,steps,done:[],feedback:null,pending:null,assisted:false,focus:!!focus,xp:0,coins:0};
  }
  function phase(r){
    if(!r)return 'idle';if(!r.steps.length)return 'complete';
    return r.feedback?'feedback':r.steps[0].kind==='study'?'study':'quiz';
  }
  function message(kind,text,extra={}){
    return {kind,message:text,correct:kind==='correct'||kind==='assisted',answer:null,xpGain:0,coinGain:0,...extra};
  }
  function view(notice=null){
    const c=current(),r=c.round,step=r?.steps[0],w=step?item(step.id):null;
    const completed=r?.done.length||0, size=r?.words.length||0;
    const hintText=r?.assisted&&w?'首字母是 '+w.word[0].toUpperCase()+'，再想想“'+w.zh+'”怎么拼。':'';
    return {stage:state.stage,phase:phase(r),word:w?{...w}:null,roundSize:size,
      position:step?Math.max(1,r.words.indexOf(step.id)+1):size,completed,
      roundWords:r?r.words.map(id=>({...item(id)})):[],roundXp:r?.xp||0,roundCoins:r?.coins||0,
      assisted:!!r?.assisted,hintText,isBridge:step?.kind==='bridge',feedback:notice||r?.feedback||null,
      stats:stats(state.stage),storageAvailable:canStore};
  }
  function settle(){
    const r=current().round,p=r?.pending;
    if(!p||settling)return;
    settling=true;
    try{
      // The wallet's per-word, per-local-day guard also handles a reload between these writes.
      const gain=p.day===day()?window.Game.rewardVocabulary(item(p.id).word,p.answer):null;
      const alreadyPaid=gain?.ok&&!gain.rewarded&&p.fresh&&window.Game.getState().vocabularyClaimedToday?.includes(item(p.id).word);
      const xp=alreadyPaid?3:count(gain?.xpGain),coins=alreadyPaid?2:count(gain?.coinGain);
      r.xp+=xp;r.coins+=coins;r.pending=null;
      if(r.feedback){r.feedback.xpGain=xp;r.feedback.coinGain=coins;}
      save();
    }finally{settling=false;}
  }
  function getState(){load();settle();return view();}
  function start(){
    load();settle();const c=current();
    if(!c.round||phase(c.round)==='complete'){
      c.round=c.suspended&&phase(c.suspended)!=='complete'?c.suspended:newRound();
      c.suspended=null;save();
    }
    return view();
  }
  function selectStage(stage){
    load();settle();
    if(validStage(stage)&&state.stage!==stage){state.stage=stage;save();}
    if(!current().round)return start();
    return getState();
  }
  function focusWord(word,stage){
    load();settle();
    const id=normalize(typeof word==='object'?word?.word:word);
    const requested=stage||(typeof word==='object'?word?.stage:null);
    const s=validStage(requested)?requested:lists[state.stage].has(id)?state.stage:stages.find(k=>lists[k].has(id));
    if(!s||!lists[s].has(id))return view();
    state.stage=s;settle();const c=current();
    if(!c.round||phase(c.round)==='complete'||!c.round.words.includes(id)){
      if(c.round&&!c.round.focus&&phase(c.round)!=='complete')c.suspended=c.round;
      c.round=newRound(id);
    }
    const r=c.round,head=r.steps[0];
    if(head?.id!==id||head.kind!=='study'||r.feedback){
      if(r.feedback)advanceStep(c,r);
      // Clicking a dictionary entry exposes its spelling. Keep the original group's
      // unfinished steps, but put another word between this model and its recall.
      const rest=r.steps.filter(step=>step.id!==id);
      const spacer=rest.shift()||{kind:'bridge',id:r.words.find(other=>other!==id)};
      r.steps=[{kind:'study',id},...(spacer.id?[spacer]:[]),
        {kind:r.done.includes(id)?'bridge':'quiz',id},...rest];
      r.feedback=null;r.assisted=false;
    }
    save();return view();
  }
  function success(id){
    const r=record(id),today=day();
    if(r.weak || r.lastDay!==today&&(!r.due||r.due<=today)){
      r.level=r.weak?1:Math.min(intervals.length,r.level+1);
      r.due=day(intervals[r.level-1]);r.weak=false;
    }
    r.lastDay=today;
  }
  function check(raw){
    const r=current().round,head=r.steps[0],id=head.id,c=current(),w=item(id),norm=normalize(raw);
    if(!norm)return view(message('empty','先拼一个词，再来核对。'));
    const correct=[w.word,...(Array.isArray(w.aliases)?w.aliases:[])].some(v=>normalize(v)===norm);
    if(!correct){
      if(head.kind!=='bridge'){const rec=record(id);rec.errors++;rec.weak=true;}
      c.blockedWord=id;
      const synonym=Array.isArray(w.alternatives)&&w.alternatives.some(v=>normalize(v)===norm);
      r.feedback=synonym
        ?message('wrong','意思也对！这张卡要练的是另一个英语词，过一张词卡后再想想。',{reason:'alternative'})
        :message('wrong','再想想“'+w.zh+'”。这个词有 '+[...w.word.replace(/\s/g,'')].length+' 个字符，一会儿换过词再试。');
    }else if(head.kind==='bridge'){
      if(c.blockedWord!==id)c.blockedWord=null;
      r.feedback=message('correct','间隔练习完成。接下来再想想刚才的词。',{answer:w.word});
    }else if(r.assisted||c.blockedWord===id){
      record(id).weak=true;c.blockedWord=id;
      r.feedback=message('assisted','借助线索拼对了。过一张不同的词卡，再试着自己拼。',{answer:w.word});
    }else{
      c.blockedWord=null;success(id);
      if(!r.done.includes(id))r.done.push(id);
      r.feedback=message('correct','独立拼对了！',{answer:w.word});
      r.pending={id,answer:norm,day:day(),fresh:!window.Game.getState().vocabularyClaimedToday?.includes(w.word)};
    }
    save();settle();return view();
  }
  function answer(raw){load();settle();return phase(current().round)==='quiz'?check(raw):view();}
  function reveal(){
    load();settle();const r=current().round;
    if(phase(r)!=='quiz')return view();
    const s=r.steps[0],w=item(s.id);
    if(s.kind!=='bridge')record(s.id).weak=true;
    current().blockedWord=s.id;
    r.feedback=message('revealed','看一眼拼法：'+w.word+'。换一张词卡后，再回来回想。',{answer:w.word});
    save();return view();
  }
  function hint(){
    load();settle();const r=current().round;
    if(phase(r)==='quiz'&&!r.assisted){
      r.assisted=true;current().blockedWord=r.steps[0].id;
      if(r.steps[0].kind!=='bridge')record(r.steps[0].id).weak=true;
      save();
    }
    return view();
  }
  function advanceStep(c,r){
    const previous=r.steps.shift(),id=previous.id;
    if(previous.kind==='study'){record(id);c.blockedWord=id;}
    else if(previous.kind!=='bridge'&&r.feedback.kind!=='correct'){
      if(!r.steps.some(s=>s.id!==id)){
        const other=r.words.find(k=>k!==id)||[...lists[state.stage].keys()].find(k=>k!==id);
        if(other)r.steps.push({kind:'bridge',id:other});
      }
      r.steps.push({kind:'quiz',id});
    }
    r.assisted=false;r.feedback=null;
  }
  function next(){
    load();settle();const c=current(),r=c.round,p=phase(r);
    if(p==='idle'||p==='complete')return start();
    if(p==='quiz')return view();
    advanceStep(c,r);save();return view();
  }
  window.WordPractice=Object.freeze({getState,selectStage,start,next,answer,reveal,hint,stats,wordStatus,focusWord});
})();

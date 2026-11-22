/* Store the explanations that actually appeared during a local calendar day. */
(() => {
  'use strict';
  const key='happylearn.daily-lessons.v1';
  const subjects={english:'英语',geography:'地理',history:'历史',chinese:'语文'};
  const sources={topic:'知识关',word:'单词',check:'提分专项',exam:'真题衔接'};
  const outcomes={correct:'独立答对',wrong:'答错待练',studied:'看过讲解',assisted:'借助提示',skipped:'还不会'};
  let history={},lastRaw=null,persistent=true,opener=null,selectedDay=null;
  const text=(v,limit=900)=>typeof v==='string'?v.trim().slice(0,limit):'';
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function today(){
    const d=new Date();
    return [String(d.getFullYear()),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);
    return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;
  }
  function entry(raw){
    if(!raw||!Object.hasOwn(subjects,raw.subject)||!Object.hasOwn(sources,raw.source)||!Object.hasOwn(outcomes,raw.outcome))return null;
    const id=text(raw.id,128),title=text(raw.title,180),note=text(raw.note);
    if(!id||!title||!note)return null;
    return {id,title,note,example:text(raw.example),subject:raw.subject,source:raw.source,outcome:raw.outcome,
      hadHelp:raw.hadHelp===true||['wrong','skipped','assisted'].includes(raw.outcome)};
  }
  function load(){
    if(!persistent)return;
    let raw;
    try{raw=localStorage.getItem(key);}catch{persistent=false;return;}
    if(raw===lastRaw)return;
    lastRaw=raw;let values;
    try{values=JSON.parse(raw);}catch{values=null;}
    history={};
    for(const [date,list] of Object.entries(values||{})){
      if(validDate(date)&&Array.isArray(list)){
        const entries=new Map();
        for(const value of list){
          const item=entry(value);if(!item)continue;
          const key=item.source+':'+item.subject+':'+item.id;
          if(entries.has(key))entries.get(key).hadHelp ||= item.hadHelp;
          else entries.set(key,item);
        }
        if(entries.size)history[date]=[...entries.values()];
      }
    }
  }
  function record(raw){
    const lesson=entry(raw);
    if(!lesson)return false;
    load();
    const date=today(),list=history[date]||[];
    const index=list.findIndex(old=>old.source===lesson.source&&old.id===lesson.id&&old.subject===lesson.subject);
    if(index>=0){
      const [prior]=list.splice(index,1);
      lesson.hadHelp=lesson.hadHelp||prior.hadHelp;
    }
    list.unshift(lesson);history[date]=list;
    if(persistent)try{
      const encoded=JSON.stringify(history);localStorage.setItem(key,encoded);lastRaw=encoded;
    }catch{persistent=false;}
    if(dialog?.open)render();
    return true;
  }
  function days(){load();return [...new Set([today(),...Object.keys(history)])].sort().reverse();}
  function lessons(date=today()){load();return validDate(date)?(history[date]||[]).map(value=>({...value})):[];}
  const dialog=document.getElementById('learn-journal');
  function render(){
    if(!dialog)return;
    const dates=days();
    if(!dates.includes(selectedDay))selectedDay=today();
    const entries=lessons(selectedDay);
    const hidden=new Set(window.WordPractice?.getPendingRecallWords?.()||[]);
    const visible=entries.filter(e=>e.source!=='word'||!hidden.has(e.id));
    const cards=visible.map(e=>{
      const outcome=e.hadHelp&&e.outcome==='correct'?'订正后独立答对':outcomes[e.outcome];
      return '<li><details><summary><span><small>'+safe(subjects[e.subject]+' · '+sources[e.source])+'</small><strong>'+safe(e.title)+'</strong></span><b>'+safe(outcome)+'</b></summary>'+
        '<div class="lj-copy"><p>'+safe(e.note)+'</p>'+(e.example?'<p class="lj-example">'+safe(e.example)+'</p>':'')+'</div></details></li>';
    }).join('');
    dialog.innerHTML='<div class="lj-top"><h2 id="lj-title" tabindex="-1">每日知识讲解</h2><button type="button" data-lj-close aria-label="关闭每日知识讲解">关闭</button></div>'+
      '<div class="lj-body"><label for="lj-date">学习日期</label><select id="lj-date">'+dates.map(d=>'<option value="'+d+'"'+(d===selectedDay?' selected':'')+'>'+d+(d===today()?' · 今天':'')+'</option>').join('')+'</select>'+
      (entries.length?'<p class="lj-meta">当天学过 '+entries.length+' 项 · 点开查看讲解</p>':'<p class="lj-empty">这一天还没有学习记录。做一道题或学一张词卡，当天的讲解就会出现在这里。</p>')+
      (cards?'<ul>'+cards+'</ul>':'')+(visible.length!==entries.length?'<p class="lj-meta">正在闭卷拼写的词，提交后可看讲解。</p>':'')+
      '<p class="lj-foot">'+(persistent?'按本机日期记录，从此次更新后开始积累。':'此浏览器暂时只能保留本次打开期间的记录。')+'</p></div>';
  }
  function open(button,date){
    if(!dialog)return;
    opener=button||document.activeElement;selectedDay=date||today();render();
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('#lj-title')?.focus({preventScroll:true});
  }
  dialog?.addEventListener('click',event=>{if(event.target.closest('[data-lj-close]'))dialog.close();});
  dialog?.addEventListener('change',event=>{
    if(event.target.id==='lj-date'){selectedDay=event.target.value;render();dialog.querySelector('#lj-date')?.focus({preventScroll:true});}
  });
  dialog?.addEventListener('close',()=>{
    if(!dialog.open){if(opener?.isConnected&&!opener.closest('[hidden],dialog:not([open])'))opener.focus({preventScroll:true});opener=null;}
  });
  window.addEventListener('storage',event=>{if(dialog?.open&&(!event.key||event.key===key))render();});
  window.LearnJournal=Object.freeze({record,days,lessons,open});
})();

/* The syllabus, medals and wardrobe all read the same completed knowledge points. */
(() => {
  'use strict';
  const subjects=window.LEARNING_CONTENT.subjects;
  const art={english:'art/english.png',geography:'art/geography.png',history:'art/history.png',chinese:'art/chinese.png'};
  const schoolMedals={english:'晨曦译者',geography:'海图领航员',history:'时光记录员',chinese:'星月读书人'};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const subjectName=id=>subjects.find(s=>s.id===id)?.name||'';
  const isSubject=id=>subjects.some(s=>s.id===id);
  const progress=()=>window.LearnRound.getTopicProgress();
  function summarize(raw){
    const existing=new Set(raw.passed),passedIds=[],bySubject={};
    let total=0;
    for(const subject of subjects){
      const entries=raw.bySubject[subject.id]||[];
      const passed=entries.filter(e=>existing.has(e.id));
      bySubject[subject.id]={passed:passed.length,total:entries.length};
      passedIds.push(...passed.map(e=>e.id));
      total+=entries.length;
    }
    return {passedIds,bySubject,totalPassed:passedIds.length,total};
  }
  function snapshot(){return summarize(progress());}

  function medals(state){
    const firstSubjects=subjects.filter(s=>state.bySubject[s.id].passed>0).length;
    const completeCount=subjects.reduce((sum,s)=>sum+Math.min(6,state.bySubject[s.id].passed),0);
    return [
      {id:'first',name:'第一枚脚印',description:'通过任意一个知识关卡',art:'art/sprite.png',value:state.totalPassed,goal:1},
      {id:'four-subjects',name:'四科启航',description:'四门学科各通过一关',art:'art/logo.png',value:firstSubjects,goal:subjects.length},
      ...subjects.map(s=>({id:s.id,name:schoolMedals[s.id],description:s.name+'通过六个不同的知识点',art:art[s.id],value:state.bySubject[s.id].passed,goal:6})),
      {id:'four-trails',name:'群岛毕业章',description:'四门学科各通过六个知识点',art:'art/treasure.png',value:completeCount,goal:6*subjects.length}
    ];
  }

  let mounted=null,activeSubject=null,lastMarkup='',popupOpener=null,timer=0,expanded=true;
  const attached=new WeakSet();
  function inferredSubject(scope){
    if(isSubject(scope))return scope;
    const state=window.LearnRound.getState();
    return state.question?.subject || (isSubject(state.subject)?state.subject:subjects[0].id);
  }
  function focusQuestion(){
    const prompt=document.querySelector('#lh-question');
    window.LearnHome?.focusQuestion?.();
    prompt?.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function topicClick(e){
    const button=e.target.closest('button');
    if(!button||button.disabled||!mounted?.contains(button))return;
    if(button.hasAttribute('data-lt-toggle')){
      expanded=!expanded;renderInline();mounted.querySelector('[data-lt-toggle]')?.focus({preventScroll:true});return;
    }
    if(button.hasAttribute('data-lt-current')){
      focusQuestion();return;
    }
    if(!button.hasAttribute('data-lt-topic'))return;
    const result=window.LearnRound.openTopic(button.dataset.ltTopic);
    if(!result.ok){renderInline();return;}
    activeSubject=result.state.question?.subject||activeSubject;
    window.dispatchEvent(new CustomEvent('learn-trail-topic',{detail:result}));
    focusQuestion();
  }
  function mountInline(el=document.getElementById('learn-trail-inline'),scope){
    if(!el)return;
    activeSubject=inferredSubject(scope);
    if(mounted!==el)lastMarkup='';
    mounted=el;
    if(!attached.has(el)){
      attached.add(el);el.addEventListener('click',topicClick);
    }
    renderInline();
  }
  function renderInline(){
    if(!mounted||!mounted.isConnected)return;
    const subject=activeSubject||subjects[0].id;
    const data=progress(),entries=data.bySubject[subject]||[],done=new Set(data.passed);
    const active=window.LearnRound.getState().question?.id;
    const passed=entries.filter(e=>done.has(e.id)).length;
    const rows=entries.map((e,i)=>{
      const learned=done.has(e.id), learning=e.id===active, locked=e.status==='locked'&&!learned;
      const label=learned?'已通过':locked?'待开启':learning?'学习中':'可学习';
      const name=window.LearnFacts?.[e.id]?.topic || e.title;
      const aria=subjectName(subject)+'第'+(i+1)+'关，'+name+'，'+label+(learned?'，可重温':'');
      return '<li><button type="button" class="lt-row lt-'+(learned?'passed':locked?'locked':'current')+'" data-lt-topic="'+escape(e.id)+'" '+
        (locked?'disabled ':'')+(learning?'aria-current="step" ':'')+'aria-label="'+escape(aria)+'">'+
        '<span class="lt-node" aria-hidden="true">'+(learned?'✓':i+1)+'</span>'+
        '<span class="lt-words"><strong>'+escape(name)+'</strong><small>'+label+'</small></span></button></li>';
    }).join('');
    const html='<div class="lt-top"><div class="lt-head"><h2><button type="button" data-lt-toggle aria-expanded="'+expanded+'" aria-controls="lt-steps">'+escape(subjectName(subject))+
      '闯关清单<span aria-hidden="true" class="lt-chevron"></span></button></h2><span class="lt-count">'+passed+' / '+entries.length+'</span></div></div>'+
      '<ol id="lt-steps" class="lt-list" '+(expanded?'':'hidden')+' aria-label="'+escape(subjectName(subject))+'关卡">'+rows+'</ol>'+
      '<button type="button" class="lt-return" data-lt-current>返回本题</button>';
    if(html===lastMarkup)return;
    const oldList=mounted.querySelector('.lt-list'),same=mounted.dataset.ltScope===subject;
    const scroll=same&&oldList?oldList.scrollLeft:0, focus=document.activeElement;
    const focusedTopic=mounted.contains(focus)?focus.dataset.ltTopic:null;
    lastMarkup=html;mounted.innerHTML=html;mounted.dataset.ltScope=subject;mounted.setAttribute('aria-label',subjectName(subject)+'闯关清单');
    const list=mounted.querySelector('.lt-list');
    if(list){
      if(scroll)list.scrollLeft=scroll;
      else if(list.scrollWidth>list.clientWidth){
        const current=list.querySelector('[aria-current="step"]')||list.querySelector('.lt-current');
        if(current)list.scrollLeft=Math.max(0,current.offsetLeft-list.offsetLeft-9);
      }
    }
    if(focusedTopic){
      const current=[...mounted.querySelectorAll('[data-lt-topic]')].find(b=>b.dataset.ltTopic===focusedTopic&&!b.disabled);
      current?.focus({preventScroll:true});
    }
  }

  const dialog=document.getElementById('learn-medals');
  function writeMedals(){
    if(!dialog)return;
    const state=snapshot(),collection=medals(state),earned=collection.filter(m=>m.value>=m.goal).length;
    dialog.innerHTML='<header class="lm-head"><div><h2 id="learn-medals-title" tabindex="-1">学习勋章</h2>'+
      '<p>已点亮 <b>'+earned+' / '+collection.length+'</b> 枚勋章，累计通过 '+state.totalPassed+' 个知识点。</p></div>'+
      '<button class="lm-close" type="button" data-lm-close aria-label="关闭学习勋章">×</button></header>'+
      '<ul class="lm-wall">'+collection.map(m=>{
        const got=m.value>=m.goal,amount=Math.min(m.value,m.goal);
        return '<li class="lm-card'+(got?' lm-earned':'')+'"><span aria-hidden="true" class="lm-ribbon"><span><img src="'+m.art+'" alt=""></span></span>'+
          '<div><h3>'+escape(m.name)+'</h3><p>'+escape(m.description)+'</p>'+
          (got?'<strong class="lm-unlocked">✓ 已获得</strong>':'<div class="lm-progress"><progress value="'+amount+'" max="'+m.goal+'" aria-label="'+escape(m.name)+'进度"></progress><small>'+amount+' / '+m.goal+'</small></div>')+
          '</div></li>';
      }).join('')+'</ul>';
  }
  function openMedals(opener=document.activeElement){
    if(!dialog)return;
    if(!dialog.open)popupOpener=opener;
    writeMedals();if(!dialog.open)dialog.showModal();
    dialog.querySelector('#learn-medals-title')?.focus({preventScroll:true});
  }
  dialog?.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-lm-close]'))dialog.close();});
  dialog?.addEventListener('close',()=>{
    if(dialog.open)return;
    const fallback=document.querySelector('#learn-home [data-learn="medals"]');
    const el=popupOpener?.isConnected&&!popupOpener.closest('[hidden]')?popupOpener:fallback;
    el?.focus({preventScroll:true});popupOpener=null;
  });

  function notifyAward(fresh){
    if(!fresh.length||document.getElementById('learn-home')?.hidden)return;
    let toast=document.getElementById('learn-medal-toast');
    if(!toast){
      toast=document.createElement('div');toast.id='learn-medal-toast';
      toast.innerHTML='<span aria-hidden="true" class="lm-toast-star">★</span><span class="lm-toast-text" role="status" aria-live="polite"></span>'+
        '<button type="button">查看勋章</button>';
      toast.querySelector('button').addEventListener('click',()=>{
        toast.hidden=true;openMedals(document.querySelector('#learn-home [data-learn="medals"]'));
      });
      document.body.append(toast);
    }
    toast.hidden=false;
    toast.querySelector('.lm-toast-text').textContent='新勋章 · '+fresh.map(m=>m.name).join('、');
    window.clearTimeout(timer);timer=window.setTimeout(()=>{toast.hidden=true;},4800);
  }
  // Awards are derived from unique topic passes. Previously earned medals are
  // already known on page load and rehearsing a topic never announces it twice.
  let earnedIds=new Set(medals(snapshot()).filter(m=>m.value>=m.goal).map(m=>m.id));
  window.addEventListener('learn-topic-progress',e=>{
    const state=e.detail?.bySubject?summarize(e.detail):snapshot(),all=medals(state);
    const fresh=all.filter(m=>m.value>=m.goal&&!earnedIds.has(m.id));
    earnedIds=new Set(all.filter(m=>m.value>=m.goal).map(m=>m.id));
    renderInline();if(dialog?.open)writeMedals();notifyAward(fresh);
    window.dispatchEvent(new CustomEvent('learn-trail-change',{detail:state}));
  });
  window.LearnTrail=Object.freeze({snapshot,mountInline,openMedals});
})();

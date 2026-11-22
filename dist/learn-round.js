/* Three short learning encounters, followed by independent recall of tricky facts. */
(() => {
  'use strict';
  const content=window.LEARNING_CONTENT, game=window.Game;
  const subjects=new Map(content.subjects.map(s=>[s.id,s]));
  const order=[...subjects.keys()], scopes=['all',...order];
  const cards=content.missions.filter(m=>subjects.has(m.subject));
  const byId=new Map(cards.map(m=>[m.id,m]));
  const storeKey='happylearn.learning.rounds.v1';
  const intervals=[1,3,7,14];
  const integer=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  const ids=v=>[...new Set(Array.isArray(v)?v.filter(id=>byId.has(id)):[])];
  const scopeName=s=>s==='all'?'四科轮练':subjects.get(s)?.name;
  const freshProgress=()=>({scope:'english',rotation:0,sequence:0,rounds:{},memory:{},passed:[],activeTopic:null,topicBySubject:{}});
  let storageOK=true,lastRaw=null,data=freshProgress(),settling=false;

  function day(offset=0) {
    const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,12);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function isDay(s) {
    if(typeof s!=='string'||!/^\d{4}-\d\d-\d\d$/.test(s))return false;
    const [y,m,d]=s.split('-').map(Number), actual=new Date(y,m-1,d,12);
    return actual.getFullYear()===y && actual.getMonth()===m-1 && actual.getDate()===d;
  }
  function material(r) {
    const id=r.phase==='complete'?null:r.mode==='review'?r.reviews[r.reviewIndex]?.id:r.ids[r.baseIndex];
    const m=byId.get(id);
    if(!m)return null;
    const f=window.LearnFacts?.[id];
    const variant=r.mode==='review'&&(r.reviews[r.reviewIndex].attempt%2===0);
    const item=variant?(f?.practice||m):m.recall;
    return {id,m,item,lesson:f?.lesson||m.memory};
  }
  function cleanRound(raw,scope,topicId=null) {
    if(!raw||!Array.isArray(raw.ids)||!['question','feedback','complete'].includes(raw.phase))return null;
    const base=ids(raw.ids);
    if(!base.length||base.length>3||(topicId&&(base.length!==1||base[0]!==topicId))||base.some(id=>scope!=='all'&&byId.get(id).subject!==scope))return null;
    if(!Array.isArray(raw.reviews)||!integer(raw.baseIndex,base.length)||!integer(raw.reviewIndex,raw.reviews.length))return null;
    if(raw.reviews.some(q=>!q||!base.includes(q.id)||!integer(q.attempt)))return null;
    const r={...raw,scope,topicId,ids:base,wrong:Array.isArray(raw.wrong)?raw.wrong.filter(i=>integer(i,2)):[],
      recovered:ids(raw.recovered).filter(id=>base.includes(id)),receipts:{},hinted:!!raw.hinted};
    for(const id of base)if(raw.receipts?.[id]===true)r.receipts[id]=true;
    if(!['learn','review'].includes(r.mode))return null;
    if(r.phase!=='complete'&&!material(r))return null;
    const item=material(r)?.item;
    if(r.phase==='feedback'&&r.selected!==item?.answer)return null;
    if(item)r.wrong=[...new Set(r.wrong.filter(i=>i!==item.answer && i<item.options.length))];
    if(r.phase!=='feedback')r.selected=null;
    if(r.pending && (r.mode!=='learn'||r.phase!=='question'||!item||r.pending.id!==material(r).id||r.pending.index!==item.answer||!isDay(r.pending.day)))r.pending=null;
    return r;
  }
  function refresh() {
    if(!storageOK)return;
    let raw;
    try {raw=localStorage.getItem(storeKey);}catch{storageOK=false;return;}
    if(raw===lastRaw)return;
    lastRaw=raw;
    const fresh=freshProgress();
    try {
      const s=JSON.parse(raw);
      if(!s){data=fresh;return;}
      if(scopes.includes(s.scope))fresh.scope=s.scope;
      fresh.passed=ids(s.passed);
      for(const id of byId.keys()){
        const key='topic:'+id,r=cleanRound(s.rounds?.[key],byId.get(id).subject,id);
        if(r)fresh.rounds[key]=r;
      }
      for(const subject of order){
        const id=s.topicBySubject?.[subject];
        if(byId.get(id)?.subject===subject&&fresh.rounds['topic:'+id])fresh.topicBySubject[subject]=id;
      }
      if(byId.has(s.activeTopic)&&fresh.rounds['topic:'+s.activeTopic]){
        fresh.activeTopic=s.activeTopic;fresh.scope=byId.get(s.activeTopic).subject;
        fresh.topicBySubject[fresh.scope]=s.activeTopic;
      }
      if(integer(s.rotation,order.length-1))fresh.rotation=s.rotation;
      if(integer(s.sequence))fresh.sequence=s.sequence;
      for(const scope of scopes) {
        const r=cleanRound(s.rounds?.[scope],scope);
        if(r)fresh.rounds[scope]=r;
      }
      for(const id of byId.keys()) {
        const m=s.memory?.[id];
        if(m&&isDay(m.due)&&isDay(m.last)&&integer(m.stage,3)&&integer(m.sequence)) {
          fresh.memory[id]={due:m.due,last:m.last,stage:m.stage,weak:!!m.weak,needsIndependent:!!m.needsIndependent,sequence:m.sequence};
          const record=fresh.memory[id];
          if(!record.needsIndependent && isDay(m.firstIndependent) && m.firstIndependent<=m.last) {
            record.firstIndependent=m.firstIndependent;
            if(isDay(m.recalledOn) && m.recalledOn>m.firstIndependent && m.recalledOn<=m.last)
              record.recalledOn=m.recalledOn;
          }
        }
      }
    } catch { /* Recover the learner's wallet independently when a round save is damaged. */ }
    // Previous round saves have dated records of independent successes.
    if(raw && !fresh.passed.length) {
      try {
        if(!Object.hasOwn(JSON.parse(raw)||{},'passed'))fresh.passed=ids([
          ...Object.keys(fresh.memory).filter(id=>!fresh.memory[id].weak),
          ...Object.values(fresh.rounds).flatMap(r=>r.recovered)
        ]);
      }catch{}
    }
    data=fresh;
  }
  function save() {
    if(!storageOK)return;
    try {const raw=JSON.stringify(data);localStorage.setItem(storeKey,raw);lastRaw=raw;}
    catch {storageOK=false;}
  }

  function rankedCards(subject) {
    const today=day(),wallet=game.getState(),claimed=new Set(wallet.quizClaimedToday);
    const dueElsewhere=new Set(wallet.dueReviews||[]);
    function score(m) {
      const memory=data.memory[m.id];
      const due=memory&&memory.due<=today;
      if(due&&memory.weak)return 0;
      if(due || (!memory&&dueElsewhere.has(m.id)))return 1;
      if(!memory&&!claimed.has(m.id))return 2;
      if(!claimed.has(m.id)&&memory?.last!==today)return 3;
      return memory||claimed.has(m.id)?4:3;
    }
    return cards.filter(m=>m.subject===subject).sort((a,b)=>score(a)-score(b)||
      (data.memory[a.id]?.sequence||0)-(data.memory[b.id]?.sequence||0));
  }
  function sequenceFor(subject) {
    return cards.filter(m=>m.subject===subject);
  }
  function getTopicProgress() {
    refresh();
    const bySubject={},passed=[...data.passed];
    for(const subject of order) {
      const sequence=sequenceFor(subject),current=sequence.find(m=>!passed.includes(m.id));
      bySubject[subject]=sequence.map((m,i)=>({id:m.id,subject,subjectName:scopeName(subject),
        title:window.LearnFacts?.[m.id]?.topic||m.title,lesson:window.LearnFacts?.[m.id]?.lesson||m.memory,
        position:i+1,status:passed.includes(m.id)?'passed':m===current?'current':'locked'}));
    }
    return {passed,total:cards.length,bySubject,topics:order.flatMap(subject=>bySubject[subject])};
  }

  function getMasteryRows() {
    const {topics}=getTopicProgress();
    const today=day(), journal=game.getState();
    // The basic round reader starts the next question and can settle a pending
    // receipt. Read existing checkpoints directly when building a report.
    const opened=new Set(Object.values(data.rounds).map(r=>material(r)?.id).filter(Boolean));
    return topics.map(topic=>{
      const {id,subject,title}=topic, mem=data.memory[id];
      const legacy=journal.reviewSchedule?.[id];
      const dueDate=mem?.due??legacy?.due??null;
      const playedToday=journal.quizClaimedToday?.includes(id)||journal.quizWrongToday?.[id]?.length;
      const lastDate=playedToday && (!mem||mem.last<today)?today:mem?.last??null;
      let status='unseen',evidence='尚无练习记录。';
      if(mem?.needsIndependent || (!mem&&(journal.mistakes?.[id]||journal.quizWrongToday?.[id]?.length))) {
        status='review';evidence='曾答错或使用提示，还需要独立回想。';
      } else if(dueDate && dueDate<=today) {
        status='review';evidence='已到复习日期，等待本次独立作答。';
      } else if(mem?.weak) {
        status='review';evidence=mem.firstIndependent?'已独立纠正，安排再巩固一次。':'这个知识点仍需巩固。';
      } else if(mem?.recalledOn && mem.recalledOn<=today) {
        status='retained';evidence=mem.firstIndependent+' 和 '+mem.recalledOn+' 均独立答对。';
      } else if(mem?.firstIndependent || topic.status==='passed') {
        status='independent';evidence=mem?.firstIndependent?'已独立答对，等待跨日验证。':'已有独立通关记录，尚待跨日验证。';
      } else if(mem || opened.has(id) || playedToday || journal.completed?.includes(id) || journal.active?.id===id) {
        status='learning';evidence='已有学习记录，尚无独立通过的证据。';
      }
      return {id,subject,title,status,lastDate,dueDate,available:topic.status!=='locked',evidence};
    });
  }

  function logTopic(m,outcome,note) {
    const fact=window.LearnFacts?.[m.id],model=fact?.model;
    const entry={source:'topic',id:m.id,title:fact?.topic||m.m.title,subject:m.m.subject,outcome,
      note:note||m.lesson+' '+m.item.hint};
    if(model?.en && model.zh)entry.example=model.en+'　'+model.zh;
    // Journal availability must never interrupt a reply or a saved checkpoint.
    try {window.LearnJournal?.record?.(entry);} catch {}
  }
  function pass(id) {
    if(data.passed.includes(id))return false;
    const next=sequenceFor(byId.get(id).subject).find(m=>!data.passed.includes(m.id));
    if(next?.id!==id)return false;
    data.passed.push(id);return true;
  }
  function signalPass(changed) {
    if(changed && typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function')
      window.dispatchEvent(new CustomEvent('learn-topic-progress',{detail:getTopicProgress()}));
  }
  function nextTopics(subject,n) {
    const sequence=sequenceFor(subject),unpassed=sequence.filter(m=>!data.passed.includes(m.id));
    if(!unpassed.length)return rankedCards(subject).slice(0,n);
    const due=n>1 && rankedCards(subject).find(m=>data.passed.includes(m.id) && data.memory[m.id]?.due<=day());
    return due?[...unpassed.slice(0,n-1),due]:unpassed.slice(0,n);
  }
  function startRound(scope,topicId=null) {
    let batch;
    if(topicId)batch=[byId.get(topicId)];
    else if(scope==='all') {
      batch=Array.from({length:3},(_,i)=>nextTopics(order[(data.rotation+i)%order.length],1)[0]);
      data.rotation=(data.rotation+3)%order.length;
    } else batch=nextTopics(scope,3);
    const r={scope,topicId,ids:batch.map(m=>m.id),phase:'question',mode:'learn',baseIndex:0,reviewIndex:0,
      reviews:[],recovered:[],receipts:{},wrong:[],hinted:false,selected:null,pending:null};
    data.rounds[topicId?'topic:'+topicId:scope]=r;save();return r;
  }
  function current() {
    refresh();
    const key=data.activeTopic?'topic:'+data.activeTopic:data.scope;
    const r=data.rounds[key]||startRound(data.scope);
    if(r.pending&&!settling)settle(r);
    return r;
  }
  function openTopic(id) {
    const topics=getTopicProgress(),entry=topics.topics.find(t=>t.id===id);
    if(!entry||entry.status==='locked')return {ok:false,reason:'locked',message:'先学会本学科的上一关，就能开启这里。',state:getState()};
    data.scope=entry.subject;data.topicBySubject[entry.subject]=id;data.activeTopic=id;
    const existing=data.rounds['topic:'+id];
    if(!existing||existing.phase==='complete')startRound(entry.subject,id);
    else save();
    return {ok:true,reason:'opened',message:entry.title,state:getState()};
  }
  function memoryFor(id,on=day()) {
    return data.memory[id]||(data.memory[id]={due:day(1),last:on,stage:0,weak:false,sequence:0});
  }
  function remember(id,supported,isRecovery,on=day()) {
    const known=data.memory[id],today=day(),mem=memoryFor(id,on);
    if(supported||isRecovery) {
      mem.stage=0;mem.weak=true;mem.due=day(1);
    } else if(!known || mem.due<=today) {
      mem.stage=known?Math.min(mem.stage+1,intervals.length-1):0;
      mem.due=day(intervals[mem.stage]);mem.weak=false;
    }
    if(!supported) {
      if(!mem.firstIndependent)mem.firstIndependent=on;
      else if(on>mem.firstIndependent && (!mem.recalledOn||on>mem.recalledOn))mem.recalledOn=on;
    }
    if(on>mem.last)mem.last=on;
    mem.sequence=++data.sequence;
  }
  function markTrouble(r,id,on=day()) {
    if(r.mode==='learn'&&!r.reviews.some(q=>q.id===id))r.reviews.push({id,attempt:0});
    const mem=memoryFor(id,on);
    mem.weak=true;mem.needsIndependent=true;mem.due=day(1);mem.stage=0;
    if(on>mem.last)mem.last=on;
    delete mem.firstIndependent;
    delete mem.recalledOn;
  }

  function snapshot(r) {
    const m=material(r),wallet=game.getState(),today=day();
    const dueCount=Object.values(data.memory).filter(p=>p.due<=today).length;
    const weakCount=Object.values(data.memory).filter(p=>p.weak).length;
    const count=Object.keys(r.receipts).length;
    const summary=r.ids.map(id=>{
      const m=byId.get(id);
      return {id,subject:m.subject,subjectName:scopeName(m.subject),lesson:window.LearnFacts?.[id]?.lesson||m.memory};
    });
    let question=null;
    if(m) {
      const {id,item,lesson}=m,sub=subjects.get(m.m.subject);
      const eliminated=r.mode==='learn'?(wallet.quizEliminatedToday?.[id]??null):null;
      question={id,subject:sub.id,subjectName:sub.name,region:sub.region,title:window.LearnFacts?.[id]?.topic||m.m.title,
        clue:r.mode==='learn'?lesson:'',prompt:item.prompt,options:[...item.options],hint:item.hint,
        explain:r.phase==='feedback'?item.explain:'',wrong:[...r.wrong],showHint:r.hinted,selected:r.selected,eliminated,
        canUseInsight:r.mode==='learn' && r.phase==='question' && eliminated===null && !!wallet.inventory?.insight &&
          !wallet.quizClaimedToday.includes(id) && item.options.some((_,i)=>i!==item.answer&&!r.wrong.includes(i))};
    }
    const baseDone=r.baseIndex+(r.mode==='learn'&&r.phase==='feedback'?1:0);
    const reviewDone=r.reviewIndex+(r.mode==='review'&&r.phase==='feedback'?1:0);
    return {topicId:r.topicId||null,subject:r.scope,subjectName:scopeName(r.scope),region:question?.region||'',subjectOrder:[...scopes],
      phase:r.phase,mode:r.mode,position:r.phase==='complete'?r.ids.length:(r.mode==='learn'?r.baseIndex:r.reviewIndex)+1,
      roundSize:r.ids.length,baseDone,reviewDone,reviewTotal:r.reviews.length,roundXp:count*15,roundCoins:count*10,
      recovered:r.recovered.length,dueCount,weakCount,question,
      recoveredIds:[...r.recovered],ids:[...r.ids],summary,
      knowledge:summary.map(v=>({id:v.id,title:window.LearnFacts?.[v.id]?.topic||byId.get(v.id).title,subject:v.subject,memory:v.lesson})),
      nextMode:r.phase==='feedback'?(reviewDone<r.reviews.length?'review':baseDone<r.ids.length?'learn':'complete'):null,
      needsIndependent:r.mode==='review'&&r.phase==='feedback'&&(r.wrong.length>0||r.hinted)};
  }
  function getState(){return snapshot(current());}
  function selectSubject(scope) {
    current();
    if(!scopes.includes(scope))return getState();
    if(data.scope===scope)delete data.topicBySubject[scope];
    data.scope=scope;data.activeTopic=data.topicBySubject[scope] || null;save();
    return getState();
  }
  function nextRound(scope) {
    const r=current();
    if(scope && scopes.includes(scope)&&scope!==r.scope)return selectSubject(scope);
    if(r.phase==='complete'&&r.topicId) {
      const next=getTopicProgress().bySubject[r.scope].find(t=>t.status==='current');
      if(next)return openTopic(next.id).state;
      delete data.topicBySubject[r.scope];data.activeTopic=null;data.scope=r.scope;save();
    }
    if(r.phase==='complete')return snapshot(startRound(r.scope));
    return snapshot(r);
  }
  function result(r,fields) {
    return {ok:false,correct:false,rewarded:false,passedNow:false,xpGain:0,coinGain:0,levelUp:false,level:game.getState().level,
      ...fields,state:snapshot(r)};
  }

  // Persist a receipt intent before touching the shared wallet. A reload retries
  // through its date+mission claim guard without charging or rewarding twice.
  function settle(r) {
    settling=true;
    try {return settlePayment(r);}finally {settling=false;}
  }
  function settlePayment(r) {
    const intent=r.pending,now=day();
    let gain={rewarded:false,xpGain:0,coinGain:0,levelUp:false,level:game.getState().level};
    if(intent.day===now) {
      const already=game.getState().quizClaimedToday.includes(intent.id);
      const payment=game.answerCityQuiz(intent.id,intent.index);
      if(!payment.ok||!payment.correct) {r.pending=null;save();return gain;}
      const earned=payment.rewarded || (already&&intent.wasUnclaimed);
      gain={rewarded:earned,xpGain:earned?15:0,coinGain:earned?10:0,levelUp:payment.levelUp,level:payment.level};
      if(earned)r.receipts[intent.id]=true;
    }
    const {id}=material(r);
    const supported=r.wrong.length>0||r.hinted||!!data.memory[id]?.needsIndependent||
      intent.usedInsight===true||(intent.day===now&&Number.isInteger(game.getState().quizEliminatedToday?.[id]));
    if(supported)markTrouble(r,id,intent.day);
    remember(id,supported,false,intent.day);
    const changed=!supported&&pass(id);
    gain.passedNow=changed;
    r.selected=intent.index;r.pending=null;r.phase='feedback';save();signalPass(changed);
    return gain;
  }

  function answer(index) {
    const r=current(),m=material(r);
    if(r.phase!=='question'||!m||!integer(index,m.item.options.length-1))return result(r,{message:'请先查看当前题目。'});
    const w=game.getState();
    if(r.wrong.includes(index)||(r.mode==='learn'&&w.quizEliminatedToday?.[m.id]===index))
      return result(r,{message:'这个选项已经排除。'});
    if(index!==m.item.answer) {
      if(r.mode==='learn')game.answerCityQuiz(m.id,index);
      r.wrong.push(index);r.hinted=true;markTrouble(r,m.id);save();
      logTopic(m,'wrong');
      return result(r,{ok:true,message:m.item.hint});
    }
    let gain={};
    const assisted=r.wrong.length>0||r.hinted||(r.mode==='learn'&&
      (data.memory[m.id]?.needsIndependent||Number.isInteger(w.quizEliminatedToday?.[m.id])));
    if(r.mode==='learn') {
      r.pending={id:m.id,index,day:day(),wasUnclaimed:!w.quizClaimedToday.includes(m.id),
        usedInsight:Number.isInteger(w.quizEliminatedToday?.[m.id])};
      save();gain=settle(r);
    } else {
      const attempt=r.reviews[r.reviewIndex].attempt;
      let changed=false;
      const supported=r.wrong.length>0||r.hinted;
      if(supported)r.reviews.push({id:m.id,attempt:attempt+1});
      else {
        if(!r.recovered.includes(m.id))r.recovered.push(m.id);
        memoryFor(m.id).needsIndependent=false;
        changed=pass(m.id);
      }
      remember(m.id,supported,true);
      gain.passedNow=changed;
      r.phase='feedback';r.selected=index;save();signalPass(changed);
    }
    logTopic(m,assisted?'assisted':'correct',m.item.explain);
    return result(r,{ok:true,correct:true,message:m.item.explain,...gain});
  }
  function hint() {
    const r=current(),m=material(r);
    if(r.phase==='question'&&m&&!r.hinted){r.hinted=true;markTrouble(r,m.id);save();logTopic(m,'assisted');}
    return snapshot(r);
  }
  function useInsight() {
    const r=current(),m=material(r);
    if(!m||r.mode!=='learn'||r.phase!=='question')return {ok:false,eliminated:null,message:'回想时试着独立选一次。',state:snapshot(r)};
    const answer=game.useQuizInsight(m.id,r.wrong);
    if(answer.ok) {
      r.hinted=true;markTrouble(r,m.id);save();
      if(answer.reason!=='already_used')logTopic(m,'assisted');
    }
    return {...answer,state:snapshot(r)};
  }
  function next() {
    const r=current();
    if(r.phase!=='feedback')return snapshot(r);
    if(r.mode==='learn')r.baseIndex++;else r.reviewIndex++;
    r.wrong=[];r.selected=null;r.hinted=false;r.phase='question';
    if(r.reviewIndex<r.reviews.length)r.mode='review';
    else if(r.baseIndex<r.ids.length)r.mode='learn';
    else r.phase='complete';
    save();return snapshot(r);
  }
  window.LearnRound=Object.freeze({getState,getTopicProgress,getMasteryRows,openTopic,selectSubject,nextRound,answer,next,hint,useInsight});
})();

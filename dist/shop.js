/* The harbour's quiz counter, item shop and personal bag share Game's wallet. */
(() => {
  'use strict';

  const dialog = document.getElementById('harbor-shop');
  const game = window.Game;
  const content = window.LEARNING_CONTENT;
  if (!dialog || !game || !content) return;
  const subjects = content.subjects;
  const questions = content.missions.filter(m => m.subject !== 'mixed' && m.recall);
  const subjectArt={english:'art/english.png',geography:'art/geography.png',history:'art/history.png',chinese:'art/chinese.png'};
  const itemArt={insight:'art/item-insight.png',shoes:'art/item-shoes.png',paint:'art/item-paint.png'};
  const tabs = {quiz:'答题赚币', shop:'道具商店', bag:'我的背包'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);
  const subjectName = id => subjects.find(s => s.id === id)?.name || '';
  const validSubject = id => subjects.some(s => s.id === id);
  const money = n => '<span class="hs-coin" aria-hidden="true"></span>' + esc(n) + ' 币';
  const shown = new Map();
  let activeTab = 'quiz', scope = 'all', mission = null, result = null, showHint = false;
  let lastSubject = -1, localWrong = [], opener = null, mutating = false, pending = false;
  let fromLesson = false, resumeLesson = '';
  let notice = '', noticeType = '', visible = false, walletMarkup='';

  dialog.innerHTML = '<div class="hs-head"><div class="hs-shopmark"><img src="art/treasure.png" alt=""></div>' +
    '<h2 id="shop-title" tabindex="-1">港城补给站</h2><button class="hs-close" type="button" data-action="close" aria-label="关闭补给站">×</button></div>' +
    '<div class="hs-wallet"></div><div class="hs-tabs" role="tablist" aria-label="补给站功能">' +
    Object.entries(tabs).map(([id,label]) => '<button type="button" role="tab" id="hs-tab-'+id+'" aria-controls="hs-content" data-tab="'+id+'">'+label+'</button>').join('') +
    '</div><div class="hs-scroll"><div class="hs-notice" role="status" aria-live="polite" aria-atomic="true"></div>' +
    '<div id="hs-content" role="tabpanel"></div></div>';
  const wallet = dialog.querySelector('.hs-wallet');
  const body = dialog.querySelector('#hs-content');
  const status = dialog.querySelector('.hs-notice');
  const scroll = dialog.querySelector('.hs-scroll');

  function choose(state, eligible=()=>true) {
    let pool = questions.filter(m => (scope === 'all' || scope === m.subject) && eligible(m));
    const unpaid = pool.filter(m => !state.quizClaimedToday.includes(m.id));
    if (unpaid.length) pool = unpaid;
    if (pool.length > 1 && mission) pool = pool.filter(m => m.id !== mission.id);
    if (scope === 'all') {
      for (let step=1; step<=subjects.length; step++) {
        const idx = (lastSubject + step) % subjects.length;
        const group = pool.filter(m => m.subject === subjects[idx].id);
        if (group.length) { pool = group; break; }
      }
    }
    let next = null;
    for (const m of pool) {
      if (!next || (shown.get(m.id) || 0) < (shown.get(next.id) || 0)) next = m;
    }
    mission = next; result = null; showHint = false; localWrong = [];
    if (mission) {
      shown.set(mission.id, (shown.get(mission.id) || 0) + 1);
      lastSubject = subjects.findIndex(s => s.id === mission.subject);
    }
  }

  function feedback(message = '', kind = '') {
    notice = message; noticeType = kind;
  }
  function action(key, label, opts = {}) {
    return '<button type="button" data-action="'+key+'" data-value="'+esc(opts.value)+'" class="hs-button '+(opts.primary?'hs-primary':'')+'"'+
      (opts.disabled?' disabled':'')+'>'+label+'</button>';
  }

  function drawWallet(s) {
    const target = Math.max(1,s.nextLevelXP);
    const levelXP = Math.min(s.levelXP,target);
    const html = '<div class="hs-wallet-level"><span class="hs-level">Lv.'+esc(s.level)+'</span><div><div class="hs-wallet-detail"><b>距下一级</b><span>'+esc(target-levelXP)+' XP</span></div>' +
      '<progress aria-label="本级经验" value="'+esc(levelXP)+'" max="'+esc(target)+'"></progress></div></div>' +
      '<div class="hs-balance" aria-label="金币余额 '+esc(s.coins)+'"><span class="hs-coin" aria-hidden="true"></span><span>金币 <b>'+esc(s.coins)+'</b></span></div>';
    if (walletMarkup !== html) {walletMarkup=html;wallet.innerHTML=html;}
  }

  function filterControl() {
    return '<label class="hs-filter"><span class="hs-sr">练习科目</span><select data-scope aria-label="练习科目">' +
      '<option value="all"'+(scope==='all'?' selected':'')+'>四科轮换</option>' +
      subjects.map(s => '<option value="'+esc(s.id)+'"'+(scope===s.id?' selected':'')+'>'+esc(s.name)+'</option>').join('') +
      '</select></label>';
  }

  function quiz(s) {
    if (!mission) choose(s);
    if (!mission) return '<p>还没有可练习的题目。</p>';
    const m = mission, q = m.recall, paid = s.quizClaimedToday.includes(m.id);
    const wrong = new Set([...(s.quizWrongToday[m.id] || []), ...localWrong]);
    const eliminated = s.quizEliminatedToday[m.id];
    const head = '<div class="hs-quiz-line"><div class="hs-subject"><img alt="" src="'+subjectArt[m.subject]+'">'+
      esc(subjectName(m.subject))+'</div>'+filterControl()+'</div>';
    const header = '<h3 class="hs-question" id="hs-question" tabindex="-1">'+esc(q.prompt)+'</h3>';
    if (result) {
      const pay = result.rewarded
        ? '<div class="hs-reward"><span>＋'+esc(result.coinGain)+' 金币</span><span>＋'+esc(result.xpGain)+' XP</span></div>'
        : '<p class="hs-practice">这题今天已领过奖励。</p>';
      const level = result.levelUp ? '<p class="hs-levelup">升级啦！现在是 Lv.'+esc(result.level)+'。</p>' : '';
      return head+header+'<div class="hs-success"><strong><span aria-hidden="true">✓</span> '+esc(q.options[q.answer])+
        '</strong><p>'+esc(q.explain)+'</p>'+pay+level+'</div><div class="hs-actions">'+action('next','下一题',{primary:true})+action('to-shop','去道具商店')+'</div>';
    }
    const choices = q.options.map((text,index) => {
      const hidden = eliminated === index, tried = wrong.has(index);
      const note = hidden ? '灵感卡已排除' : tried ? '已试过' : '';
      return '<button type="button" class="hs-answer" data-action="answer" data-value="'+index+'"'+(note?' disabled':'')+
        '><span class="hs-letter" aria-hidden="true">'+String.fromCharCode(65+index)+'</span><span>'+esc(text)+'</span>'+
        (note?'<small>'+note+'</small>':'')+'</button>';
    }).join('');
    const remainingWrong = q.options.filter((_,i) => i !== q.answer && i !== eliminated && !wrong.has(i)).length;
    const count = s.inventory.insight || 0;
    const canUse = !paid && eliminated === undefined && remainingWrong > 0 && count > 0;
    const insightButton = count || eliminated !== undefined ? action('insight',
      eliminated!==undefined?'本题已用灵感卡':'用灵感卡排除一项（'+count+'）',{disabled:!canUse}) : '';
    const hint = showHint ? '<div class="hs-hint"><b>线索</b><span>'+esc(q.hint)+'</span></div>' : '';
    return head+header+'<div class="hs-stake">'+(paid?'今天已领币 · 巩固练习':'今日首次答对　＋10 币 · ＋15 XP')+'</div>'+
      '<div class="hs-choices" role="group" aria-labelledby="hs-question">'+choices+'</div>'+hint+'<div class="hs-actions">'+
      action('hint',showHint?'收起提示':'看提示')+insightButton+'</div>';
  }

  function itemRow(item,s,bag) {
    const consumable = item.kind === 'consumable';
    const owned = s.owned.includes(item.id);
    const count = s.inventory[item.id] || 0;
    const equipped = Boolean(s.equipped[item.id]);
    let statusText,button;
    if (bag) {
      statusText = consumable ? '背包内 ×'+count : equipped?'已装备':'已拥有';
      button = consumable ? action('use-in-quiz','去答题使用',{primary:true}) :
        action('equip',equipped?'卸下':'装备',{value:item.id,primary:!equipped});
    } else if (!consumable && owned) {
      statusText = equipped?'已装备':'已拥有';
      button = action('to-bag','查看背包');
    } else if (s.coins < item.price) {
      statusText = '还差 '+(item.price-s.coins)+' 币';
      button = action('to-quiz','答题赚币');
    } else {
      statusText = consumable?'已有 '+count+' 张':'永久道具';
      button = action('buy','购买',{value:item.id,primary:true});
    }
    return '<article class="hs-item"><div class="hs-item-icon hs-icon-'+esc(item.id)+'"><img alt="" width="44" height="44" src="'+itemArt[item.id]+'"></div>'+
      '<div class="hs-item-copy"><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="hs-item-meta">'+
      (bag?'':'<strong>'+money(item.price)+'</strong>')+'<span>'+esc(statusText)+'</span></div></div><div class="hs-item-action">'+button+'</div></article>';
  }

  function store(s, bag) {
    const items = game.catalog.filter(item => !bag || (item.kind === 'consumable' ? s.inventory[item.id] > 0 : s.owned.includes(item.id)));
    if (!items.length && bag) {
      return '<div class="hs-empty"><img src="art/treasure.png" alt=""><h3>背包还是空的</h3><p>答对一道新题能领 10 币，够买一张灵感卡。</p>'+
        '<div class="hs-actions">'+action('to-quiz','答一题',{primary:true})+action('to-shop','看看商店')+'</div></div>';
    }
    return '<div class="hs-items">'+items.map(item => itemRow(item,s,bag)).join('')+'</div>';
  }

  function rememberFocus() {
    const el = document.activeElement;
    if (!body.contains(el)) return null;
    if (el.hasAttribute('data-scope')) return ['scope',''];
    return el.dataset.action ? [el.dataset.action,el.dataset.value || ''] : null;
  }
  function focusInside(key) {
    if (!key || !dialog.open) return;
    let target = key[0] === 'question' ? body.querySelector('.hs-question') : key[0] === 'scope' ? body.querySelector('[data-scope]') : [...body.querySelectorAll('[data-action]:not(:disabled)')].find(el=>el.dataset.action===key[0]&&(key[1]==null||el.dataset.value===key[1]));
    if (!target && key[0]==='answer') target=body.querySelector('.hs-answer:not(:disabled),[data-action="next"]');
    if (!target) target = dialog.querySelector('[data-tab][aria-selected="true"]');
    target?.focus({preventScroll:true});
  }

  function render(focusKey = rememberFocus()) {
    if (!dialog.open) return;
    const s = game.getState();
    drawWallet(s);
    const nodes = dialog.querySelectorAll('[data-tab]');
    nodes.forEach(btn => {
      const selected = activeTab === btn.dataset.tab;
      btn.setAttribute('aria-selected',String(selected));
      btn.tabIndex = selected ? 0 : -1;
    });
    body.setAttribute('aria-labelledby','hs-tab-'+activeTab);
    body.innerHTML = activeTab==='quiz' ? quiz(s) : store(s,activeTab==='bag');
    status.dataset.kind=noticeType;
    if (status.textContent!==notice) status.textContent=notice;
    focusInside(focusKey);
  }

  function switchTo(tab, scopeArg, focusTab = true) {
    if (!(tab in tabs)) tab = 'quiz';
    activeTab = tab;
    if (tab === 'quiz' && scopeArg !== undefined && scopeArg !== scope) {
      scope = validSubject(scopeArg) ? scopeArg : 'all';
      choose(game.getState());
    }
    feedback(); render(null);scroll.scrollTop=0;
    if (focusTab) dialog.querySelector('[data-tab="'+tab+'"]')?.focus({preventScroll:true});
  }
  function visibility(open) {
    if (visible===open) return;
    visible=open;
    window.dispatchEvent(new CustomEvent('harbor-shop-visibility',{detail:{open}}));
  }
  function open(tab='quiz',subjectId) {
    const wasOpen = dialog.open;
    if (!wasOpen) {
      opener = document.activeElement;
      fromLesson = document.body.classList.contains('in-learn') && Boolean(window.LearnHome);
      resumeLesson = '';
      dialog.querySelector('[data-tab="quiz"]').hidden = fromLesson;
      const close = dialog.querySelector('.hs-close');
      close.textContent = fromLesson ? '回去学习' : '×';
      close.classList.toggle('hs-back-lesson',fromLesson);
      close.setAttribute('aria-label', fromLesson ? '回到当前学习题' : '关闭补给站');
      if (fromLesson && tab === 'quiz') tab = 'shop';
      dialog.showModal();
      visibility(true);
    }
    if(tab==='quiz' && validSubject(subjectId) && subjectId===scope && result) choose(game.getState());
    switchTo(tab,tab==='quiz'?(validSubject(subjectId)?subjectId:'all'):undefined,wasOpen);
    if (!wasOpen) dialog.querySelector('#shop-title').focus({preventScroll:true});
  }
  function onClose() {
    if (dialog.open) return;
    visibility(false);
    const target=opener;opener=null;
    if (resumeLesson && fromLesson) {
      const focusCard = resumeLesson === 'use-in-quiz';
      resumeLesson = '';
      window.LearnHome.focusQuestion?.(focusCard);
      return;
    }
    if(target?.isConnected&&!target.closest?.('[hidden],dialog:not([open])')) target.focus({preventScroll:true});
  }
  function handle(actionName,value) {
    if(mutating)return;
    if (fromLesson && ['close','to-quiz','use-in-quiz'].includes(actionName)) {
      resumeLesson = actionName;
      dialog.close();
      return;
    }
    if (actionName==='close') {dialog.close();return;}
    if (actionName==='to-quiz' || actionName==='use-in-quiz') {
      const s=game.getState(), forCard=actionName==='use-in-quiz';
      const eligible=m=>!s.quizClaimedToday.includes(m.id) && (!forCard || (
        s.quizEliminatedToday[m.id]===undefined && m.recall.options.some((_,i)=>i!==m.recall.answer&&!(s.quizWrongToday[m.id]||[]).includes(i))
      ));
      if(!mission || result || !eligible(mission)){
        if(!questions.some(m=>(scope==='all'||m.subject===scope)&&eligible(m)))scope='all';
        if(questions.some(eligible)) choose(s,eligible);
        else if(forCard){feedback('今天没有需要排除选项的新题，灵感卡已留在背包。','gentle');render();return;}
        else choose(s);
      }
      switchTo('quiz',undefined,false);focusInside(['question',null]);return;
    }
    if (actionName.startsWith('to-')) {switchTo(actionName.slice(3));return;}
    let nextFocus=null;
    mutating=true;
    try {
      feedback();
      if (actionName==='answer' && mission && !result) {
        const idx=Number(value), outcome=game.answerCityQuiz(mission.id,idx);
        if (!outcome.ok) {feedback(outcome.message || '再选一次试试。','gentle');}
        else if(outcome.correct) {
          result=outcome;
          feedback(outcome.rewarded?'答对了，奖励已放入钱包。':'答对了！','good');
          nextFocus=['next',null];
        } else {
          localWrong=[...new Set([...localWrong,idx])];showHint=true;
          feedback('换个方向想想，线索已经展开。','gentle');nextFocus=['answer',null];
        }
      } else if (actionName==='next') {
        choose(game.getState());nextFocus=['question',null];
      } else if (actionName==='hint') {
        showHint=!showHint;
        if(showHint)feedback(mission.recall.hint,'hint');
        nextFocus=['hint',null];
      } else if (actionName==='insight' && mission && !result) {
        const s=game.getState(),wrong=[...new Set([...(s.quizWrongToday[mission.id]||[]),...localWrong])];
        if (s.quizEliminatedToday[mission.id]===undefined&&mission.recall.options.some((_,i)=>i!==mission.recall.answer&&!wrong.includes(i))){
          const response=game.useQuizInsight(mission.id,wrong);
          feedback(response.ok?'灵感卡排除了一个选项。':response.message || '暂时不能使用这张卡。',response.ok?'good':'gentle');
        }
        nextFocus=['answer',null];
      } else if (actionName==='buy') {
        const item=game.catalog.find(i=>i.id===value), response=game.buyItem(value);
        const purchased=item?.kind==='permanent'&&game.getState().equipped[value] ? item.name+'已购买并装备。' : '已把'+(item?.name||'道具')+'放进背包。';
        feedback(response.ok?purchased:response.message || '这次购买没有完成。',response.ok?'good':'gentle');
        nextFocus=response.ok&&item.kind==='permanent'?['to-bag',null]:['buy',value];
      } else if (actionName==='equip') {
        const item=game.catalog.find(i=>i.id===value), enable=!game.getState().equipped[value];
        const response=game.equipItem(value,enable);
        feedback(response.ok?(enable?'已装备':'已卸下')+item.name+'。':response.message || '这次装备没有完成。',response.ok?'good':'gentle');
        nextFocus=['equip',value];
      }
      render(nextFocus);
    } finally { mutating=false; }
  }
  dialog.addEventListener('close',onClose);
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button || button.disabled || !dialog.contains(button)) return;
    if (button.dataset.tab) switchTo(button.dataset.tab);
    else if (button.dataset.action) handle(button.dataset.action,button.dataset.value);
  });
  dialog.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-scope')) {
      switchTo('quiz',event.target.value,false);
      body.querySelector('[data-scope]')?.focus({preventScroll:true});
    }
  });
  dialog.addEventListener('keydown',event=>{
    if(!event.target.dataset.tab)return;
    const all=[...dialog.querySelectorAll('[data-tab]:not([hidden])')];
    const pos=all.indexOf(event.target);
    let i=pos;
    if(event.key==='ArrowRight')i=(pos+1)%all.length;
    else if(event.key==='ArrowLeft')i=(pos+all.length-1)%all.length;
    else if(event.key==='Home')i=0;
    else if(event.key==='End')i=all.length-1;
    else return;
    event.preventDefault();switchTo(all[i].dataset.tab);
  });
  game.subscribe(()=>{
    if (!dialog.open || mutating || pending) return;
    pending=true;
    queueMicrotask(()=>{pending=false;if(dialog.open&&!mutating)render();});
  });
  window.HarborShop=Object.freeze({open});
})();

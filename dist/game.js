/* Offline field missions, checkpoints and the explorer's memory journal. */
(() => {
  'use strict';

  const { subjects, missions } = window.LEARNING_CONTENT;
  const byId = new Map(missions.map(mission => [mission.id, mission]));
  const vocabulary = new Map((window.EnglishWords || []).map(entry => [entry.word,entry]));
  const worlds = new Map(subjects.map(subject => [subject.id, subject]));
  worlds.set('mixed', { id: 'mixed', name: '四科联动', region: '群岛联合远征', summary: '把在四个岛上学到的本领带进同一次冒险。' });
  const art = { english: 'forest', geography: 'harbor', history: 'ruins', chinese: 'academy', mixed: 'hero' };
  const storeKey = 'happylearn.islands.field.v1';
  const listeners = new Set();
  const catalog = Object.freeze([
    { id:'insight', name:'灵感卡', price:8, kind:'consumable', description:'答题时排除一个错误选项。' },
    { id:'shoes', name:'疾行跑鞋', price:32, kind:'permanent', description:'装备后，步行和奔跑速度提高 35%。' },
    { id:'paint', name:'霓虹玫红车漆', price:48, kind:'permanent', description:'给你的敞篷车换上霓虹玫红色。' }
  ].map(Object.freeze));
  const products = new Map(catalog.map(item=>[item.id,item]));
  const blankWallet = () => ({ quizzes:{}, reviews:{}, vocabulary:{}, eligible:{}, errors:{}, used:{}, bought:0, owned:[], equipped:{shoes:false,paint:false} });
  const blank = () => ({ completed: [], reviewed: [], reviewSchedule: {}, mistakes: {}, checkpoints: {}, last: null, wallet:blankWallet() });
  const clone = value => JSON.parse(JSON.stringify(value));
  const uniqueIds = value => [...new Set(Array.isArray(value) ? value.filter(id => byId.has(id)) : [])];
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const list = world => missions.filter(mission => mission.subject === world);
  const rank = mission => list(mission.subject).findIndex(item => item.id === mission.id) + 1;
  const mixedOpen = () => subjects.every(s => state.completed.some(id => byId.get(id).subject === s.id));
  const xpFor = m => m.subject === 'mixed' ? 40 : 20;

  const reviewIntervals = [1, 3, 7];

  function dateKey(date) {
    const pad = n => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  // Local calendar days keep tomorrow's appointment stable across clock changes.
  function localDay(offset = 0) {
    const now = new Date();
    return dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));
  }

  function validDay(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const [year, month, day] = key.split('-').map(Number);
    return dateKey(new Date(year, month - 1, day, 12)) === key;
  }

  function scheduleReview(id, stage) {
    state.reviewSchedule[id] = { stage, due: localDay(reviewIntervals[stage]) };
  }

  function cardsByDate() {
    return [...state.completed].sort((a, b) =>
      state.reviewSchedule[a].due.localeCompare(state.reviewSchedule[b].due) ||
      (state.mistakes[b] || 0) - (state.mistakes[a] || 0));
  }

  function dueReviews() {
    const today = localDay();
    return cardsByDate().filter(id => state.reviewSchedule[id].due <= today);
  }

  function reviewDate(id) {
    const due = state.reviewSchedule[id].due;
    if (due <= localDay()) return '今天可复习';
    if (due === localDay(1)) return '明天复习';
    const [year, month, day] = due.split('-').map(Number);
    return (year === new Date().getFullYear() ? '' : year + '年') + month + '月' + day + '日复习';
  }

  function isCityQuiz(id) {const m=byId.get(id);return !!m && m.subject!=='mixed';}
  const has = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const coinsFor = m => m.subject === 'mixed' ? 24 : 12;
  const countClaims = days => Object.values(days).reduce((total,ids)=>total+ids.length,0);
  const insightKey = (mode,id) => [mode,localDay(),id].join('/');

  function earnedCoins(completed,w) {
    return completed.reduce((n,id)=>n+coinsFor(byId.get(id)),0) +
      10*countClaims(w.quizzes) + 5*countClaims(w.reviews) + 2*countClaims(w.vocabulary);
  }

  // Progress and dated claims are the ledger. Balances are derived, so old
  // saves acquire their earned currency and duplicate claims never add funds.
  function totals() {
    const w=state.wallet, quizzes=countClaims(w.quizzes), reviews=countClaims(w.reviews);
    const xp=state.completed.reduce((n,id)=>n+xpFor(byId.get(id)),0)+15*quizzes+8*reviews+3*countClaims(w.vocabulary);
    const earned=earnedCoins(state.completed,w);
    const spent=w.bought*products.get('insight').price+w.owned.reduce((n,id)=>n+products.get(id).price,0);
    return {xp,coins:Math.max(0,earned-spent),level:1+Math.floor(xp/80),levelXP:xp%80,nextLevelXP:80};
  }

  function decodeWallet(raw,completed) {
    const w=blankWallet();
    if(!raw || typeof raw!=='object')return w;
    for(const [field,allowed] of [['quizzes',isCityQuiz],['reviews',id=>completed.includes(id)],['vocabulary',word=>vocabulary.has(word)]]) {
      for(const [day,ids] of Object.entries(raw[field]||{})) {
        if(!validDay(day))continue;
        const cleaned=Array.isArray(ids) ? [...new Set(ids.filter(allowed))] : [];
        if(cleaned.length)w[field][day]=cleaned;
      }
    }
    for(const id of completed)if(validDay(raw.eligible?.[id]))w.eligible[id]=raw.eligible[id];
    for(const [day,items] of Object.entries(raw.errors||{})) {
      if(!validDay(day) || !items || typeof items!=='object')continue;
      const checks={};
      for(const [id,attempts] of Object.entries(items)) {
        if(!isCityQuiz(id)||!Array.isArray(attempts))continue;
        const item=byId.get(id).recall;
        const wrong=[...new Set(attempts.filter(i=>Number.isInteger(i)&&i>=0&&i<item.options.length&&i!==item.answer))];
        if(wrong.length)checks[id]=wrong;
      }
      if(Object.keys(checks).length)w.errors[day]=checks;
    }
    const owned=Array.isArray(raw.owned)?raw.owned:[];
    w.owned=['shoes','paint'].filter(id=>owned.includes(id));
    for(const id of w.owned)w.equipped[id]=raw.equipped?.[id]!==false;
    w.bought=Number.isSafeInteger(raw.bought)&&raw.bought>0?raw.bought:0;
    const earned=earnedCoins(completed,w);
    // Ignore unaffordable inventory from an interrupted or malformed save.
    let remaining=earned;
    w.owned=w.owned.filter(id=>{
      const price=products.get(id).price;
      if(price>remaining){w.equipped[id]=false;return false;}
      remaining-=price;return true;
    });
    w.bought=Math.min(w.bought,Math.floor(remaining/products.get('insight').price));
    let used=0;
    for(const [key,i] of Object.entries(raw.used||{})) {
      const [mode,day,id,...extra]=key.split('/');
      if(extra.length||!validDay(day)||!byId.has(id)||!['mission','recall','quiz'].includes(mode))continue;
      if((mode==='quiz'&&!isCityQuiz(id))||(mode==='recall'&&!completed.includes(id)))continue;
      const m=byId.get(id),item=mode==='mission'?m:m.recall;
      if(used<w.bought && Number.isInteger(i)&&i>=0&&i<item.options.length&&i!==item.answer){w.used[key]=i;used++;}
    }
    return w;
  }

  function decode(raw) {
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return blank();
      const out = blank();
      out.completed = uniqueIds(saved.completed);
      out.wallet=decodeWallet(saved.wallet,out.completed);
      out.reviewed = uniqueIds(saved.reviewed).filter(id => out.completed.includes(id));
      for (const id of out.completed) {
        const entry = saved.reviewSchedule?.[id];
        // Undated cards from older saves are available today. Their first
        // successful scheduled review will start the one-day interval.
        out.reviewSchedule[id] = entry && Number.isInteger(entry.stage) &&
          entry.stage >= -1 && entry.stage < reviewIntervals.length && validDay(entry.due)
          ? { stage: entry.stage, due: entry.due }
          : { stage: -1, due: localDay() };
      }
      for (const id of byId.keys()) {
        const misses = saved.mistakes?.[id];
        if (Number.isInteger(misses) && misses > 0) out.mistakes[id] = misses;
      }
      for (const world of worlds.keys()) {
        const cp = saved.checkpoints?.[world];
        if (!cp || byId.get(cp.id)?.subject !== world) continue;
        const points = sites(byId.get(cp.id));
        const found = [...new Set(Array.isArray(cp.found) ? cp.found.filter(i => Number.isInteger(i) && i >= 0 && i < points.length) : [])];
        out.checkpoints[world] = { id: cp.id, found, step: cp.step === 'choice' && found.length === points.length ? 'choice' : 'search', selected: found.includes(cp.selected) ? cp.selected : null, hint: !!cp.hint };
      }
      if (worlds.has(saved.last) && out.checkpoints[saved.last]) out.last = saved.last;
      return out;
    } catch { return blank(); }
  }

  let lastRaw=null;
  function load() {
    try { lastRaw=localStorage.getItem(storeKey);return decode(lastRaw); }
    catch { return blank(); }
  }

  function refresh() {
    if(!storageAvailable)return;
    try {
      const raw=localStorage.getItem(storeKey);
      if(raw!==lastRaw){state=decode(raw);lastRaw=raw;}
    } catch { storageAvailable=false; }
  }
  const insightCount = () => Math.max(0,state.wallet.bought-Object.keys(state.wallet.used).length);

  function getState() {
    refresh();
    const active = state.checkpoints[state.last] || Object.values(state.checkpoints).at(-1) || null;
    const today=localDay(),w=state.wallet,quizEliminatedToday={};
    for(const m of missions) {
      const key='quiz/'+today+'/'+m.id;
      if(has(w.used,key))quizEliminatedToday[m.id]=w.used[key];
    }
    return clone({ ...totals(),inventory:{insight:insightCount()},owned:w.owned,equipped:w.equipped,
      vocabularyClaimedToday:w.vocabulary[today]||[],quizClaimedToday:w.quizzes[today]||[],quizEliminatedToday,quizWrongToday:w.errors[today]||{},shards: state.completed.length, completed: state.completed, memories: state.completed, reviewed: state.reviewed, dueReviews: dueReviews(), reviewSchedule: state.reviewSchedule, active, mistakes: state.mistakes });
  }

  function notify() {
    const snapshot = getState();
    listeners.forEach(fn => { try { fn(snapshot); } catch (error) { console.error(error); } });
  }

  let storageAvailable = true;
  function save() {
    try { const raw=JSON.stringify(state);localStorage.setItem(storeKey,raw);lastRaw=raw; }
    catch { storageAvailable = false; }
    notify();
  }

  function failure(reason,message,extra={}) {
    return {ok:false,reason,message,...extra};
  }
  function buyItem(id) {
    refresh();
    const item=products.get(id),w=state.wallet;
    const result={id,coins:totals().coins};
    if(!item)return failure('invalid_item','找不到这件道具。',result);
    if(item.kind==='permanent' && w.owned.includes(id))return {...result,ok:true,reason:'already_owned',message:'你已经拥有这件道具。'};
    if(result.coins<item.price)return failure('insufficient_coins','金币不足，答对城市题目或完成岛屿任务就能赚金币。',result);
    if(item.kind==='consumable')w.bought++;
    else {w.owned.push(id);w.equipped[id]=true;}
    save();
    return {ok:true,id,coins:totals().coins,reason:'purchased',message:item.name+'已购入。'};
  }
  function equipItem(id,enabled) {
    refresh();
    const result={id,coins:totals().coins};
    if(typeof enabled!=='boolean'||!state.wallet.owned.includes(id))return failure('not_owned','请先拥有这件道具。',result);
    if(state.wallet.equipped[id]!==enabled) {state.wallet.equipped[id]=enabled;save();}
    return {ok:true,...result,reason:enabled?'equipped':'unequipped',message:enabled?'已装备。':'已卸下。'};
  }
  function claim(field,id,day=localDay()) {
    const days=state.wallet[field],ids=days[day]||(days[day]=[]);
    if(ids.includes(id))return false;
    ids.push(id);return true;
  }
  function rewardVocabulary(word,answer) {
    refresh();
    const entry=vocabulary.get(word);
    const normalize=s=>s.trim().toLowerCase().replace(/’/g,"'").replace(/\s+/g,' ');
    const before=totals().level;
    const empty={correct:false,rewarded:false,xpGain:0,coinGain:0,levelUp:false,level:before};
    if(!entry || typeof answer!=='string')return failure('invalid_word','请再试试看。',empty);
    const accepted=[entry.word,...(entry.aliases||[])];
    if(!accepted.some(value=>normalize(value)===normalize(answer)))return failure('try_again','再想想这个词的拼写。',empty);
    const rewarded=claim('vocabulary',word);
    if(rewarded)save();
    const level=totals().level;
    return {ok:true,correct:true,rewarded,xpGain:rewarded?3:0,coinGain:rewarded?2:0,levelUp:level>before,level};
  }
  function answerCityQuiz(id,index) {
    refresh();
    const base={correct:false,rewarded:false,xpGain:0,coinGain:0,levelUp:false,level:totals().level};
    if(!isCityQuiz(id))return failure('invalid_quiz','找不到这道题。',base);
    const item=byId.get(id).recall,w=state.wallet,day=localDay();
    if(!Number.isInteger(index)||index<0||index>=item.options.length)return failure('invalid_option','请选择一个有效选项。',base);
    if(w.used[insightKey('quiz',id)]===index)return failure('eliminated','灵感卡已经排除了这个选项。',base);
    if(index!==item.answer) {
      const errors=w.errors[day]||(w.errors[day]={}),wrong=errors[id]||(errors[id]=[]);
      if(!wrong.includes(index)){wrong.push(index);save();}
      return {ok:true,...base,reason:'try_again',message:item.hint};
    }
    const rewarded=claim('quizzes',id,day);
    if(rewarded)save();
    const level=totals().level;
    return {ok:true,correct:true,rewarded,xpGain:rewarded?15:0,coinGain:rewarded?10:0,
      levelUp:level>base.level,level,reason:rewarded?'rewarded':'already_claimed',message:item.explain};
  }
  function useInsightFor(mode,id,wrong=[]) {
    refresh();
    const m=byId.get(id),noCard={eliminated:null};
    if(!m||(mode==='quiz'&&!isCityQuiz(id)))return failure('invalid_quiz','找不到这道题。',noCard);
    const key=insightKey(mode,id),w=state.wallet;
    if(has(w.used,key))return {ok:true,reason:'already_used',eliminated:w.used[key],message:'这个选项已经排除。'};
    if(mode==='quiz'&&w.quizzes[localDay()]?.includes(id))return failure('completed','这道题今天已经答对了。',noCard);
    const item=mode==='mission'?m:m.recall;
    const excluded=new Set(Array.isArray(wrong)?wrong:[]);
    if(mode==='quiz')for(const i of w.errors[localDay()]?.[id]||[])excluded.add(i);
    const eliminated=item.options.findIndex((_,i)=>i!==item.answer&&!excluded.has(i));
    if(eliminated<0)return failure('no_option','剩下的选项里已没有可以排除的错误答案。',noCard);
    if(insightCount()<1)return failure('no_insight','背包里没有灵感卡。',noCard);
    w.used[key]=eliminated;save();
    return {ok:true,eliminated,reason:'used',message:'灵感卡帮你排除了一个错误选项。'};
  }
  function useQuizInsight(id,wrong) {return useInsightFor('quiz',id,wrong);}
  function sites(mission) {
    if (Array.isArray(mission.sites) && mission.sites.length > 0) return mission.sites;
    return [{ label: '调查现场', text: mission.scene }, { label: '寻找线索', text: mission.hint }];
  }

  let state = load();
  let view = null;
  let opener = null;
  const dialog = document.getElementById('game-dialog');
  dialog.classList.add('gm-dialog');
  dialog.setAttribute('aria-labelledby', 'gm-title');

  const glyphs = {
    flag: ['.....kk.....','....kttkkkk.','....ktttttk.','....ktttkk..','....kttk....','....kttttk..','....kkkkkk..','....khk.....','....khk.....','....khk.....','...kkkkk....'],
    book: ['.kkkk..kkkk.','kggghkkhgggk','kghhhkkhhhgk','kggghkkhgggk','kghhhkkhhhgk','kggghkkhgggk','kggghkkhgggk','kkgggkkgggkk','..kkkddkkk..'],
    compass: ['.....kk.....','...kkggkk...','..kggttggk..','.kghhttthgk.','.kghttthhgk.','.kghhtgghgk.','.kggtgggggk.','..kggggggk..','...kkggkk...','.....kk.....'],
    gem: ['.....hh.....','....htth....','...htttth...','..htthgggh..','.htthgggggh.','htthgggggggh','.hthgggggdk.','..htggggdk..','...hgggdk...','....hgdk....','.....kk.....'],
    sprout: ['.kk.........','kttkk...kkk.','ktgttk.ktttk','.kgggtkttggk','..kkggkgttk.','....kgttkk..','.....kgk....','.....kgk....','...kkkkkk...'],
    scroll: ['.kkkkkkkk...','khtttttthk..','khtkkttthk..','.ktttttttk..','.ktkkktttk..','.ktttttttk..','.ktkkttttk..','.ktttttttkk.','..kkkkkkkkhk'],
    key: ['...kkkk.....','..kggggk....','.kgghhggk...','.kggkkggk...','..kggggk....','...kkggk....','.....kggk...','......kggkk.','.......kgggk','........kkk.'],
    crate: ['..kkkkkkkk..','.ktgtttgtgk.','ktggtttggttk','kkkkkkkkkkkk','kghgkttkghgk','kgghggggghgk','kggghgghgggk','kgtggttggtgk','kkkkkkkkkkkk'],
    stone: ['....kkkk....','...khgghk...','..khgggggk..','..kggtgggk..','..kgtttggk..','..kggtgggk..','..kggggggk..','.kggggggggk.','kkkkkkkkkkkk'],
    star: ['.....kk.....','....kttk....','....kttk....','.kkkthhtkkk.','kttthhhhtttk','.kthhhhgttk.','..kthhggtk..','..kthgggtk..','.kttk..kttk.','.kkk....kkk.'],
    paw: ['.kk..kk..kk.','ktgkktgkktgk','ktgkktgkktgk','.kk..kk..kk.','....kkkk....','...ktgggk...','..ktgggggk..','.ktgggggggk.','.kggggggggk.','..kkk..kkk..'],
    bull: ['.kk......kk.','khtk....kthk','.khtkkkkt hk.'.replace(/ /g,''),'..ktgtggtgk.','..kgggggggk.','...khggghk..','...kgkkkgk..','...ktttttk..','....kkkkk...'],
    bird: ['......kkk...','.....khtgkk.','.....kgtgttk','..kkkggggkk.','.kttgggggk..','kttgggggk...','.kkkkggk....','.....ktk....','....ktttk...'],
    camel: ['........kkk.','..kk.kk.kthk','.ktgktgkkttk','ktgggggggtk.','ktgggggggtk.','.kgggggggk..','..ktk..kgk..','..kgk..kgk..','.kkkk..kkkk.'],
    owl: ['.kk......kk.','kggkk..kkggk','kggggkkggggk','kghhgggghhgk','khkkhgg hkkhk'.replace(/ /g,''),'khkkhtthkkhk','.khhgttghhk.','.kggghhgggk.','..kggghggk..','...kkkkkk...','..kttkkttk..']
  };
  const palettes = {
    gold: { k:'#302437', d:'#864c2a', g:'#cd823c', t:'#ffd273', h:'#fff3af' },
    red: { k:'#492c3a', d:'#722e37', g:'#c15048', t:'#ff8c72', h:'#ffcfad' },
    mint: { k:'#102f33', d:'#176357', g:'#38a983', t:'#8fe3a6', h:'#ddffd0' },
    blue: { k:'#102b40', d:'#1b628a', g:'#409bbb', t:'#8ee2e3', h:'#e1fff0' },
    lilac: { k:'#302746', d:'#684b8c', g:'#ae80bc', t:'#deb1e6', h:'#fff0ed' }
  };
  const dye = { english: 'mint', geography: 'blue', history: 'gold', chinese: 'lilac', mixed: 'gold' };
  const icon = (name, hue = 'gold') => '<canvas class="gm-sprite" aria-hidden="true" data-sprite="' + name + '" data-dye="' + hue + '"></canvas>';

  function paint() {
    dialog.querySelectorAll('canvas[data-sprite]').forEach(canvas => {
      const pixels = glyphs[canvas.dataset.sprite] || glyphs.gem;
      const colors = palettes[canvas.dataset.dye] || palettes.gold;
      canvas.width = Math.max(...pixels.map(row => row.length));
      canvas.height = pixels.length;
      const pen = canvas.getContext('2d');
      if (!pen) return;
      pixels.forEach((row, y) => [...row].forEach((col, x) => {
        if (colors[col]) { pen.fillStyle = colors[col]; pen.fillRect(x, y, 1, 1); }
      }));
    });
  }

  function objectIcon(label, idx, subject) {
    if (/图|罗盘|方向|指针|钟|仪|方位|指北/.test(label)) return 'compass';
    if (/信|纸|笺|卷|条|诗|签|册|简|画|笔|书|名单|名牌/.test(label)) return 'scroll';
    if (/稻|米|叶|花|草|树|谷|种|枝|松|竹|苗/.test(label)) return 'sprout';
    if (/商|货|包|箱|屋|棚|铺|仓|房/.test(label)) return 'crate';
    if (/门|锁|钥|扣/.test(label)) return 'key';
    if (/石|碑|岩|刻|骨|陶/.test(label)) return 'stone';
    if (/鸟|猫头鹰|伙伴|船长|队员|信使/.test(label)) return 'owl';
    return ({ english:['flag','scroll'], geography:['compass','flag'], history:['crate','stone'], chinese:['scroll','book'], mixed:['flag','compass'] })[subject][idx % 2];
  }

  function action(label, cmd, args = '', style = 'gm-primary') {
    return '<button type="button" class="gm-action ' + style + '" data-act="' + cmd + '" data-value="' + safe(args) + '">' + label + '</button>';
  }
  const closeButton = '<button type="button" class="gm-x" data-act="close" aria-label="关闭窗口">×</button>';
  const steps = (step, names) => '<div class="gm-steps" aria-label="探险进度">' + names.map((v,i) => '<span class="' + (i === step ? 'is-now' : i < step ? 'is-done' : '') + '">' + (i < step ? '✓ ' : '') + safe(v) + '</span>').join('') + '</div>';
  const head = (category, title) => '<div class="gm-head"><div><div class="gm-eyebrow">' + safe(category) + '</div><h2 id="gm-title" tabindex="-1">' + safe(title) + '</h2></div>' + closeButton + '</div>';
  const artClass = world => 'gm-art gm-art-' + art[world];

  function mount(html, focus, samePage = false) {
    const previous = dialog.contains(document.activeElement) && document.activeElement.closest('[data-act]');
    const previousKey = samePage && previous ? [previous.dataset.act, previous.dataset.value ?? ''] : null;
    const oldScroll = dialog.scrollTop;
    if (!dialog.open) {
      opener = document.activeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open','');
    }
    dialog.innerHTML = '<div class="gm-shell">' + html + '</div>';
    paint();
    let target = focus ? dialog.querySelector(focus) : null;
    if (!target && previousKey) target = [...dialog.querySelectorAll('[data-act]')].find(el => el.dataset.act === previousKey[0] && (el.dataset.value ?? '') === previousKey[1]);
    (target || dialog.querySelector('#gm-title'))?.focus({ preventScroll: true });
    dialog.scrollTop = samePage ? oldScroll : 0;
  }

  function close() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else { dialog.removeAttribute('open'); finishClose(); }
  }
  function finishClose() {
    view = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  function region(world) {
    if (!worlds.has(world)) return;
    if (world === 'mixed' && !mixedOpen()) return locked();
    const subject = worlds.get(world), levels = list(world), done = levels.filter(m => state.completed.includes(m.id)).length;
    view = { type:'region', world };
    const cp = state.checkpoints[world];
    const next = cp?.id || levels.find(m => !state.completed.includes(m.id))?.id;
    const rows = levels.map((m, i) => {
      const finished = state.completed.includes(m.id), status = cp?.id === m.id ? '继续探索' : finished ? '可再探索' : m.id === next ? '从这里出发' : '可探索';
      return '<button class="gm-row" data-act="begin" data-value="' + safe(m.id) + '"><span class="gm-row-num">' + (finished ? '✓' : String(i + 1).padStart(2,'0')) + '</span><span>' + safe(m.title) + '</span><small>' + status + '</small></button>';
    }).join('');
    mount(head(subject.name + ' · 区域地图', subject.region) + '<div class="' + artClass(world) + ' gm-banner"><p>' + safe(subject.summary) + '</p><span>' + done + ' / ' + levels.length + ' 已探索</span></div><div class="gm-rows">' + rows + '</div>');
  }

  function start(world, id) {
    refresh();
    if (!worlds.has(world)) return;
    if (world === 'mixed' && !mixedOpen()) return locked();
    const existing = state.checkpoints[world];
    const candidate = id || existing?.id || list(world).find(m => !state.completed.includes(m.id))?.id || list(world)[0]?.id;
    const m = byId.get(candidate);
    if (!m || m.subject !== world) return;
    const cp = existing?.id === m.id ? existing : { id:m.id, step:'search', found:[], selected:null, hint:false };
    state.checkpoints[world] = cp;
    state.last = world;
    view = { type:'mission', id:m.id, wrong:[], feedback:'', walker:[48,77] };
    if (cp.selected !== null) view.walker = beside(pointPosition(cp.selected, sites(m).length));
    save();
    renderMission();
  }

  function pointPosition(index, total) {
    return total === 1 ? [49,59] : [[25,63],[73,42],[51,68]][index % 3];
  }

  function beside([x,y]) {
    return [x > 50 ? x - 9 : x + 9, y + 11];
  }

  function explorer() {
    const [x,y] = view.walker;
    const [oldX,oldY] = view.from || view.walker;
    const arrival = view.from ? ' gm-arriving' : '';
    const sparkle = view.discovery ? '<span class="gm-spark">✦</span>' : '';
    return '<span aria-hidden="true" class="gm-walker' + arrival + '" style="--x:' + x + '%;--y:' + y + '%;--from-x:' + oldX + '%;--from-y:' + oldY + '%">' + sparkle + '</span>';
  }

  function hotspots(m, cp) {
    const points = sites(m);
    const last = cp.selected;
    return '<div class="' + artClass(m.subject) + ' gm-field" role="group" tabindex="0" aria-label="关卡探索场景" aria-describedby="gm-move-help"><span class="gm-field-label">✦ 调查现场</span>' +
      points.map((point, i) => {
        const found = cp.found.includes(i);
        const positions = pointPosition(i, points.length);
        return '<button type="button" class="gm-point ' + (found ? 'is-found ' : '') + (last === i ? 'is-here' : '') + '" style="--x:' + positions[0] + '%;--y:' + positions[1] + '%" data-act="inspect" data-value="' + i + '" aria-label="' + safe(point.label) + (found ? '，已调查，可重看' : '，调查线索') + '"><span class="gm-pin">' + icon(objectIcon(point.label, i, m.subject), dye[m.subject]) + '</span><span class="gm-tag">' + (found ? '✓ ' : '') + safe(point.label) + '</span></button>';
      }).join('') + explorer() + '</div><p id="gm-move-help" class="gm-move-help">方向键或滑动空地移动阿芽，靠近线索即可拾取。也可直接点线索。</p>';
  }

  function renderMission(update = false, focus = null) {
    const m = byId.get(view.id), cp = state.checkpoints[m.subject];
    if (!cp || cp.id !== m.id) return region(m.subject);
    const points = sites(m), world = worlds.get(m.subject);
    const heading = head(world.region + ' · 任务 ' + String(rank(m)).padStart(2,'0'), m.title);
    if (cp.step === 'choice') return choiceScreen(m, false, update);
    const point = points[cp.selected];
    const full = cp.found.length === points.length;
    const copy = point ? point.text : '画面里有' + (points.length === 2 ? '两处' : points.length + '处') + '发光的线索。带阿芽去找找，它们藏着什么？';
    const block = '<div class="gm-note" role="status"><div class="gm-note-icon">' + icon(point ? 'scroll':'owl', dye[m.subject]) + '</div><div><strong>' + safe(point?.label || '向导提示') + '</strong><p>' + safe(copy) + '</p></div></div>';
    const right = full ? action('带着线索行动', 'to-choice') : '<span class="gm-progress">'+cp.found.length+' / '+points.length+' 处已发现</span>';
    mount(heading + steps(0,['寻找线索','采取行动','获得碎片']) + hotspots(m, cp) + '<div class="gm-body">' + block + '<div class="gm-foot">' + action('区域地图','region',m.subject,'gm-quiet') + right + '</div></div>', focus, update);
  }

  // A few missions put the decision directly on a map, trail or letter tile.
  // Every control remains a labelled button for touch and keyboard players.
  const playboards = {
    'geo-direction': {kind:'compass', label:'港口方位图', emblems:['◀','▼','▶']},
    'en-colour': {kind:'tracks', label:'脚印岔路口', emblems:['paw','paw','paw']},
    'hi-farming': {kind:'pasture', label:'古田模型箱', emblems:['bull','bird','camel']},
    'cn-verb': {kind:'tiles', label:'缺字木刻板', emblems:['挪','蹿','躺']}
  };

  function choiceScreen(m, recall, update = false) {
    const item = recall ? m.recall : m, cp = state.checkpoints[m.subject], hint = recall ? view.hint : cp.hint;
    const world = worlds.get(m.subject);
    const heading = head(recall ? world.region + ' · 记忆回响' : world.region + ' · 任务 ' + String(rank(m)).padStart(2,'0'), recall ? '再用一次这条知识' : m.title);
    const board = !recall && playboards[m.id];
    const usedKey=insightKey(recall?'recall':'mission',m.id);
    const excluded=state.wallet.used[usedKey];
    const insightButton=!has(state.wallet.used,usedKey)&&insightCount()>0
      ? action('使用灵感卡（'+insightCount()+'）','insight','','gm-quiet') : '';

    const choices = item.options.map((opt, i) => {
      const missed = view.wrong.includes(i)||excluded===i;
      let emblem = '<span>' + ['A','B','C','D'][i] + '</span>';
      if (board?.kind === 'tracks') emblem = '<span aria-hidden="true">' + icon('paw',['mint','blue','red'][i]) + '</span>';
      if (board?.kind === 'pasture') emblem = '<span aria-hidden="true">' + icon(board.emblems[i],'gold') + '</span>';
      if (board && ['compass','tiles'].includes(board.kind)) emblem = '<span aria-hidden="true">' + board.emblems[i] + '</span>';
      return '<button type="button" data-act="answer" data-value="' + i + '" class="gm-answer ' + (missed ? 'gm-missed' : '') + '" ' + (missed ? 'disabled' : '') + '>' + emblem + safe(opt) + '</button>';
    }).join('');
    const boardLabel = board ? '<div class="gm-board-label">' + safe(board.label) + '</div>' : '';
    const compass = board?.kind === 'compass' ? '<span class="gm-north" aria-hidden="true">↑ 北</span><div class="gm-origin">' + icon('stone','gold') + '<small>钟楼</small></div>' : '';
    const choiceGroup = boardLabel + '<div class="gm-options' + (board ? ' gm-playboard gm-' + board.kind : '') + '">' + compass + choices + '</div>';
    const scene = recall ? '' : '<details class="gm-details"'+(view.cluesOpen ? ' open' : '')+'><summary>重看现场线索</summary>' + sites(m).map(point => '<p><b>' + safe(point.label) + '</b>　' + safe(point.text) + '</p>').join('') + '</details>';
    const notice = view.feedback || (hint ? item.hint : '');
    const feedback = '<div role="status" class="gm-feedback ' + (notice ? 'is-visible' : '') + '">' + (notice ? '<strong>向导</strong>　' + safe(notice) : '') + '</div>';
    mount(heading + (recall ? '' : steps(1,['寻找线索','采取行动','获得碎片'])) + '<div class="' + artClass(m.subject) + ' gm-question-banner">' + icon(recall ? 'book':'compass',dye[m.subject]) + '</div><div class="gm-body"><h3 class="gm-question">' + safe(item.prompt) + '</h3>' + choiceGroup + feedback + '<div class="gm-tools">' + action('给我一点提示','hint','','gm-quiet') + insightButton + (recall ? action('返回图鉴','journal','','gm-quiet') : '') + '</div>' + scene + '</div>', update && view.wrong.length ? '.gm-answer:not(:disabled)' : null, update);
  }

  function answer(i) {
    if (!view || !['mission','recall'].includes(view.type)) return;
    const m = byId.get(view.id), recall = view.type === 'recall', item = recall ? m.recall : m;
    const wallet=state.wallet,day=localDay(),due=recall&&(state.reviewSchedule[m.id]?.due<=day||wallet.eligible[m.id]===day);
    if(i===wallet.used[insightKey(recall?'recall':'mission',m.id)])return;
    if (recall && !state.completed.includes(m.id)) return journal();
    if ((!recall && (state.checkpoints[m.subject]?.id!==m.id || state.checkpoints[m.subject]?.step !== 'choice')) || !Number.isInteger(i) || !(i in item.options) || view.wrong.includes(i)) return;
    if (i !== item.answer) {
      view.wrong.push(i);
      view.feedback = '换个角度看看。' + item.hint;
      state.mistakes[m.id] = (state.mistakes[m.id] || 0) + 1;
      if (recall) {
        if(due)wallet.eligible[m.id]=day;
        state.reviewed = state.reviewed.filter(id => id !== m.id);
        scheduleReview(m.id, 0);
        view.feedback = '没关系，明天还会遇见这张卡。' + item.hint;
      }
      save();
      return choiceScreen(m, recall, true);
    }
    const before=totals(),fresh=!state.completed.includes(m.id);
    if(recall&&due)claim('reviews',m.id,day);
    if(recall)delete wallet.eligible[m.id];
    if (recall) {
      const appointment = state.reviewSchedule[m.id];
      if (view.wrong.length || view.hint || has(wallet.used,insightKey('recall',m.id))) scheduleReview(m.id, 0);
      else if (appointment.due <= localDay()) {
        scheduleReview(m.id, Math.min(appointment.stage + 1, reviewIntervals.length - 1));
      }
      if (!state.reviewed.includes(m.id)) state.reviewed.push(m.id);
      delete state.mistakes[m.id];
    } else {
      if (fresh) {
        state.completed.push(m.id);
        scheduleReview(m.id, 0);
      }
      delete state.checkpoints[m.subject];
      if (state.last === m.subject) state.last = Object.keys(state.checkpoints).at(-1) || null;
    }
    const after=totals();
    view = { type:'reward',id:m.id,recall,fresh,xpGain:after.xp-before.xp,coinGain:after.coins-before.coins,levelUp:after.level>before.level,level:after.level };
    save();
    reward();
  }

  function reward() {
    const m = byId.get(view.id), recall = view.recall;
    const next = list(m.subject).find(other => !state.completed.includes(other.id));
    const due = dueReviews();
    const continueReview = due.length ? action('继续今日复习（' + due.length + '）','recall',due[0]) : action('回到知识图鉴','journal');
    const mainAction = recall ? continueReview : next ? action('出发去下一站','begin',next.id) : action('回到世界地图','close');
    const gains=view.xpGain?'　·　经验 +'+view.xpGain+'　·　金币 +'+view.coinGain:'';
    const earned=(recall?'成功唤醒这段记忆':view.fresh?'知识碎片 +1':'再次完成了这个任务')+gains+
      (view.levelUp?'　·　升至 LV. '+view.level:'');
    const shopLink=window.HarborShop?.open?action('去道具商店','shop','','gm-quiet'):'';
    const nextAction = recall ? action('查看这张记忆卡','card',m.id,'gm-quiet') : action('查看知识图鉴','journal','','gm-quiet');
    const previous = !recall && (due.find(id => id !== m.id) || state.completed.find(id => id !== m.id && !state.reviewed.includes(id)));
    const memoryInvite = previous ? '<div class="gm-echo"><div><b>来自上一站的回响</b><p>' + safe(byId.get(previous).title) + '</p></div>' + action('唤醒旧碎片','recall',previous,'gm-quiet') + '</div>' : '';
    const storageNote = storageAvailable ? '' : '<p class="gm-save-note">此浏览器暂时无法保存进度，本次游玩的奖励仍可在图鉴中查看。</p>';
    mount(head(worlds.get(m.subject).region, recall ? '记忆唤醒！' : '任务完成！') + '<div class="' + artClass(m.subject) + ' gm-treasure"><span>' + icon(recall ? 'book':'gem',dye[m.subject]) + '</span></div><div class="gm-body"><div class="gm-reward-line">✦ ' + earned + '</div><h3 class="gm-card-title">' + safe(m.title) + '</h3><p>' + safe((recall ? m.recall : m).explain) + '</p><div class="gm-fact"><b>记忆碎片 · ' + reviewDate(m.id) + '</b>' + safe(m.memory) + '</div>' + memoryInvite + storageNote + '<div class="gm-foot">' + shopLink + nextAction + mainAction + '</div></div>');
  }

  function journal(filter = 'all') {
    const due = dueReviews();
    const labels = { all: '全部碎片', due: '今日复习（' + due.length + '）', weak: '再练一次', known: '已唤醒' };
    if (!Object.hasOwn(labels, filter)) filter = 'all';
    view = {type:'journal',filter};
    const items = cardsByDate().filter(id => {
      if (filter === 'due') return due.includes(id);
      if (filter === 'weak') return !state.reviewed.includes(id) || state.mistakes[id];
      if (filter === 'known') return state.reviewed.includes(id);
      return true;
    }).map(id => byId.get(id));
    const cards = items.map(m => '<button type="button" class="gm-card" data-act="card" data-value="' + safe(m.id) + '"><div class="' + artClass(m.subject) + ' gm-card-art">' + icon('gem',dye[m.subject]) + '</div><div class="gm-card-info"><small>' + safe(worlds.get(m.subject).name) + ' · ' + reviewDate(m.id) + '</small><b>' + safe(m.title) + '</b></div></button>').join('');
    const firstUpcoming = cardsByDate()[0];
    const emptyText = filter === 'due' && firstUpcoming ? '今天的复习完成了。下一张卡' + reviewDate(firstUpcoming) + '，也可以回全部碎片自由练习。' : '这一栏还没有碎片。';
    const empty = state.completed.length ? '<div class="gm-empty">' + icon('book','mint') + '<p>' + emptyText + '</p></div>' : '<div class="gm-empty">' + icon('book','gold') + '<h3>图鉴等着你的第一枚碎片</h3><p>去森林找猫头鹰，完成一次任务，就能把知识碎片带回来。</p>' + action('去晨曦森林','start','english') + '</div>';
    const todayAction = due.length ? '<div class="gm-echo"><div><b>今天有 ' + due.length + ' 张卡等你唤醒</b><p>从最早到期的那张开始。</p></div>' + action('开始今日复习','recall',due[0]) + '</div>' : '';
    mount(head('探险收藏', '知识图鉴') + '<div class="gm-body"><p class="gm-intro">新碎片明天再见。记得越牢，两次相遇就隔得越久。也可以随时翻卡练习。</p><div class="gm-tabs">' + Object.entries(labels).map(([key,label]) => '<button type="button" aria-pressed="' + (filter === key) + '" data-act="journal-filter" data-value="' + key + '">' + label + '</button>').join('') + '</div>' + todayAction + (cards ? '<div class="gm-gallery">' + cards + '</div>' : empty) + '</div>');
  }

  function card(id) {
    const m = byId.get(id);
    if (!m || !state.completed.includes(id)) return journal();
    view = {type:'card',id};
    mount(head(worlds.get(m.subject).region + ' · 记忆卡',m.title) + '<div class="' + artClass(m.subject) + ' gm-treasure"><span>' + icon('gem',dye[m.subject]) + '</span></div><div class="gm-body"><div class="gm-fact"><b>记住这一条 · ' + reviewDate(id) + '</b>' + safe(m.memory) + '</div><p>' + safe(m.explain) + '</p><div class="gm-foot">' + action('返回图鉴','journal','','gm-quiet') + action('在新场景试一试','recall',id) + '</div></div>');
  }

  function recall(id) {
    const m = byId.get(id);
    if (!m || !state.completed.includes(id)) return journal();
    view = {type:'recall',id,wrong:[],hint:false,feedback:''};
    choiceScreen(m,true);
  }

  function achievements() {
    const completed = state.completed.length;
    view = {type:'achievements'};
    const badges = [
      {label:'初来乍到', desc:'完成第一项探险任务',value:completed,goal:1,glyph:'flag',hue:'mint'},
      ...subjects.map(s => ({label:s.region + '探索者',desc:'完成' + s.region + '的全部任务',value:state.completed.filter(id=>byId.get(id).subject === s.id).length,goal:list(s.id).length,glyph:'gem',hue:dye[s.id]})),
      {label:'记忆守护者',desc:'在新场景中唤醒四张记忆卡',value:state.reviewed.length,goal:4,glyph:'book',hue:'lilac'},
      {label:'群岛领航员',desc:'完成全部联合远征',value:state.completed.filter(id => byId.get(id).subject === 'mixed').length,goal:list('mixed').length,glyph:'compass',hue:'gold'}
    ].filter(b => b.goal > 0);
    mount(head('探险足迹','冒险勋章') + '<div class="gm-body gm-badges">' + badges.map(b => '<div class="gm-badge ' + (b.value>=b.goal ? 'is-earned' : '') + '">' + icon(b.glyph,b.hue) + '<div><b>' + safe(b.label) + '</b><p>' + safe(b.desc) + '</p></div><small>' + (b.value>=b.goal ? '已点亮' : b.value + ' / ' + b.goal) + '</small></div>').join('') + '</div>');
  }

  function locked() {
    view = {type:'locked'};
    const missing = subjects.filter(s => !state.completed.some(id => byId.get(id).subject === s.id));
    mount(head('四科联动','群岛联合远征') + '<div class="gm-art gm-art-hero gm-treasure"><span>' + icon('compass','gold') + '</span></div><div class="gm-body"><h3 class="gm-card-title">集齐四岛的航线印记</h3><p>在每个学科岛上完成任意一项任务，就能启航。远征里会同时用到不同学科的线索。</p><div class="gm-rows">' + subjects.map(s => '<button type="button" class="gm-row" data-act="region" data-value="' + safe(s.id) + '"><span class="gm-row-num">' + (missing.includes(s) ? '◇' : '✓') + '</span><span>' + safe(s.region) + '</span><small>' + (missing.includes(s) ? '去收集' : '已收集') + '</small></button>').join('') + '</div></div>');
  }

  function activeField() {
    if (view?.type !== 'mission') return null;
    const mission = byId.get(view.id);
    const cp = state.checkpoints[mission.subject];
    return cp?.step === 'search' && cp.id === mission.id ? {mission,cp} : null;
  }

  function inspect(index, at) {
    refresh();
    const field = activeField();
    if (!field || !Number.isInteger(index)) return;
    const points = sites(field.mission);
    if (!points[index]) return;
    const cp = field.cp;
    view.discovery = !cp.found.includes(index);
    if (view.discovery) cp.found.push(index);
    cp.selected = index;
    view.from = view.walker;
    view.walker = at || beside(pointPosition(index, points.length));
    save();
    renderMission(true, at ? '.gm-field' : null);
    view.from = null;
    view.discovery = false;
  }

  function walk(x, y) {
    const field = activeField();
    if (!field) return;
    const points = sites(field.mission);
    const [oldX,oldY] = view.walker;
    const dx = Math.max(5,Math.min(95,x)) - oldX;
    const dy = Math.max(13,Math.min(88,y)) - oldY;
    // Sample the travelled path so a long swipe cannot skip a clue.
    const steps = Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy)) / 5));
    for (let i = 1; i <= steps; i++) {
      const at = [oldX + dx*i/steps,oldY + dy*i/steps];
      const hit = points.findIndex((point,index) => {
        const [px,py] = pointPosition(index,points.length);
        return !field.cp.found.includes(index) && Math.hypot((at[0]-px)/12,(at[1]-py)/16) <= 1;
      });
      if (hit !== -1) return inspect(hit,at);
    }
    view.walker = [oldX + dx,oldY + dy];
    const walker = dialog.querySelector('.gm-walker');
    walker?.classList.remove('gm-arriving');
    walker?.style.setProperty('--x',view.walker[0] + '%');
    walker?.style.setProperty('--y',view.walker[1] + '%');
  }

  const arrows = {ArrowLeft:[-7,0], ArrowRight:[7,0], ArrowUp:[0,-9], ArrowDown:[0,9]};
  dialog.addEventListener('keydown',event => {
    const step = arrows[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey || !activeField()) return;
    event.preventDefault();
    walk(view.walker[0]+step[0],view.walker[1]+step[1]);
  });

  let drag = null;
  dialog.addEventListener('pointerdown',event => {
    const field = event.target.closest('.gm-field');
    if (!field || event.target.closest('button') || event.button !== 0 || !event.isPrimary) return;
    drag = {field,id:event.pointerId,x:event.clientX,y:event.clientY};
    field.setPointerCapture?.(event.pointerId);
  });
  dialog.addEventListener('pointercancel',() => { drag = null; });
  dialog.addEventListener('pointerup',event => {
    if (!drag || drag.id !== event.pointerId) return;
    const start = drag;
    drag = null;
    if (!start.field.isConnected || !activeField()) return;
    const {left,top,width,height} = start.field.getBoundingClientRect();
    if (!width || !height) return;
    const dx = event.clientX-start.x, dy = event.clientY-start.y;
    if (Math.hypot(dx,dy) < 6) walk((event.clientX-left)*100/width,(event.clientY-top)*100/height);
    else walk(view.walker[0]+dx*100/width,view.walker[1]+dy*100/height);
  });

  dialog.addEventListener('close',finishClose);
  dialog.addEventListener('click',event => {
    refresh();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      return;
    }
    const button = event.target.closest('[data-act]');
    if (!button || button.disabled) return;
    const act = button.dataset.act, value = button.dataset.value;
    switch (act) {
      case 'close': close(); break;
      case 'begin': { const m=byId.get(value); if(m) start(m.subject,m.id); break; }
      case 'start': start(value); break;
      case 'region': region(value); break;
      case 'journal': journal(); break;
      case 'journal-filter': journal(value); break;
      case 'card': card(value); break;
      case 'recall': recall(value); break;
      case 'answer': answer(Number(value)); break;
      case 'inspect': inspect(Number(value)); break;
      case 'to-choice': {
        const m = byId.get(view?.id), cp = m && state.checkpoints[m.subject];
        if (!cp || cp.id!==m.id || cp.found.length !== sites(m).length) break;
        cp.step='choice'; save(); renderMission(); break;
      }
      case 'shop': {
        if(window.HarborShop?.open) {close();window.HarborShop.open('shop');}
        break;
      }
      case 'insight': {
        if(!view || !['mission','recall'].includes(view.type))break;
        const m=byId.get(view.id),recalling=view.type==='recall';
        if(!recalling && (state.checkpoints[m.subject]?.id!==m.id||state.checkpoints[m.subject]?.step!=='choice'))break;
        const result=useInsightFor(recalling?'recall':'mission',m.id,view.wrong);
        view.feedback=result.message;
        choiceScreen(m,recalling,true);
        break;
      }
      case 'hint': {
        const m = byId.get(view?.id);
        if (!m) break;
        if (view.type === 'recall') view.hint = true;
        else if (state.checkpoints[m.subject]?.id===m.id) state.checkpoints[m.subject].hint = true;
        else break;
        view.feedback = '';
        save(); choiceScreen(m,view.type === 'recall',true); break;
      }
    }
  });

  dialog.addEventListener('toggle', e => { if(e.target.matches?.('.gm-details') && view) view.cluesOpen = e.target.open; },true);
  window.addEventListener('storage',e => {
    if (!storageAvailable || (e.key !== storeKey && e.key !== null)) return;
    state=load(); notify();
    if (dialog.open && view) {
      if (view.type === 'mission') renderMission();
      if (view.type === 'journal') journal(view.filter);
      if (view.type === 'region') region(view.world);
      if (view.type === 'achievements') achievements();
      if (view.type === 'locked' && mixedOpen()) region('mixed');
    }
  });
  window.Game = Object.freeze({
    getState,catalog,buyItem,equipItem,answerCityQuiz,rewardVocabulary,useQuizInsight,start,openRegion:region,openJournal:journal,openAchievements:achievements,
    startMixed: () => mixedOpen() ? start('mixed') : locked(),
    subscribe(fn) { if(typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); }
  });
})();


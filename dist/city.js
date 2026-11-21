/* Port HUD and the link between physical locations, driving and the learning contracts. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const city = $('#city'), scene = $('#city-scene'), phone = $('#port-phone');
  const task = $('#port-objective'), clue = $('#port-clue'), phase = $('#port-phase');
  const action = $('#port-action'), actionText = action.querySelector('span');
  const distanceText = $("#port-distance");
  const radar = $('#port-radar'), status = $('#port-toast'), reward = $('#port-reward');
  const jobs = window.CityJobs.create(), rally = window.CityRally.create();
  const contracts = window.CityJobs.list;
  const subjectNames = {english:'英语', geography:'地理', history:'历史', chinese:'语文', mixed:'四科接力'};
  const places = ['pier','market','museum','lighthouse'].map(key => window.CityWorld.places[key]);
  const recallPrompts = {
    english:'包裹写着 Blue East Stop，要去什么颜色、哪个方向的站点？',
    geography:'北向上的地图上，先向东再向南，路线会怎样拐弯？',
    history:'展柜里的稻谷、小篆和西域使者行囊，按年代怎样摆放？',
    chinese:'给风铃写一句听觉描写，再让海风像人一样做一件事。'
  };
  const portPrefs = 'happylearn.sunset-harbor.prefs.v1';
  let prefs = {paint:'', discoveries:[],visited:false};
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(portPrefs)) || {}); } catch {}
  if (!Array.isArray(prefs.discoveries)) prefs.discoveries = [];
  const persist = () => { try { localStorage.setItem(portPrefs, JSON.stringify(prefs)); } catch {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const drivingMode = {contact:'交谈',pickup:'取件',delivery:'交付',collection:'装箱',recording:'采集',navigation:'测绘',relay:'交接'};
  let engine = null, player = {x:1.5,z:2,heading:0,driving:false,speed:0,nearCar:true,carX:4,carZ:0};
  let markers = [], personalPin = null, near = null, app = 'jobs', visible = false, paused = true;
  let toastTimer = 0, uiTime = -1000, method = '3d', panelOpener = null;
  let heldPointers = new Map(), lastAutoMark = null;
  let shownDrivingControls = false;
  let cityHint = '', rewardSubject = '';
  let audioReady = false;
  const radio = $('#port-radio');
  if (['off','motor','wave','coast'].includes(prefs.station)) radio.value=prefs.station;
  function enableAudio() {
    if (audioReady || !visible) return;
    audioReady = true;
    window.CityAudio?.setStation(radio.value);
    window.CityAudio?.unlock?.();
  }
  city.addEventListener('pointerdown',enableAudio,{capture:true});
  window.addEventListener('keydown',enableAudio,{capture:true});

  function toast(text, ms=4000) {
    clearTimeout(toastTimer);
    status.textContent = text;
    status.hidden = !text;
    if (text) toastTimer = setTimeout(() => {status.hidden = true;}, ms);
  }
  function setText(el, value) { if(el.textContent !== value) el.textContent = value; }
  function setPaused() {
    paused = !visible || document.hidden || phone.open || $('#harbor-shop').open;
    engine?.pause(paused);
    window.CityAudio?.setPaused(paused);
    rally.freeze();
    if (paused) releaseTouch();
  }
  function syncMarkers() {
    markers = rally.snapshot().active ? rally.markers() : jobs.markers();
    if (personalPin) markers = [...markers,{id:'custom-pin',label:personalPin.name,x:personalPin.x,z:personalPin.z,color:'#f690cf',kind:'pin'}];
    markers = markers.map(m => m.highlighted ? {...m,color:'#ffe681',label:'★ ' + m.label} : m);
    engine?.setTargets(markers);
    lastAutoMark = null;
    uiTime = -1000;
  }
  function renderTask() {
    const race = rally.snapshot(), job = jobs.current();
    $('#port-hint').hidden = !job || race.active;
    if (race.active) {
      setText($('#port-category'),'海岸试车');
      setText(task, race.index ? '穿过下一道光门' : '开车穿过起点');
      setText(phase, race.index + ' / ' + race.total);
      setText(clue, race.index ? (rally.markers()[0]?.label || '') : '上车驶入金色光圈后才开始计时。');
    } else if (job) {
      setText($('#port-category'), subjectNames[job.subject] + ' · ' + job.title);
      setText(task,job.stepTitle);
      setText(phase,(job.step+1) + ' / ' + job.total);
      setText(clue,cityHint || job.clue);
    } else {
      setText($('#port-category'),'自由探索');
      setText(task,personalPin ? '前往' + personalPin.name : '去海边兜兜风');
      setText(phase,'');
      setText(clue,personalPin ? '粉色标记是你的目的地，抵达后可收集地标印记。' : '打开委托手机接单、试车，或在地图上选个想去的地方。');
    }
  }
  function district() {
    if(player.x>97) return '白沙海岸';
    if(player.x<-60) return '老城博物区';
    if(player.z>51) return '海风南街';
    if(player.z<-60) return '北港商街';
    return '棕榈大道';
  }
  function nearby() {
    return markers.filter(m=>m.kind!=='pin' && m.kind!=='gate')
      .map(m=>({m,d:distance(player,m)})).filter(v=>v.d<=6.8).sort((a,b)=>a.d-b.d)[0]?.m;
  }
  function refreshHUD() {
    near = nearby();
    window.CityAudio?.setDrive?.(player.driving,player.speed);
    const target = markers.find(m=>m.highlighted) || markers.reduce((a,b)=>!a||distance(player,b)<distance(player,a)?b:a,null);
    if (target) {
      const bearing=Math.atan2(target.x-player.x,player.z-target.z);
      const direction=['北','东北','东','东南','南','西南','西','西北'][(Math.round(bearing/(Math.PI/4))+8)%8];
      setText(distanceText,direction+' · '+Math.round(distance(player,target))+' 米'+(markers.length>1?' · 最近路标':''));
    } else setText(distanceText,'');
    const race = rally.snapshot();
    const context = near ? (drivingMode[near.kind] || '互动') + ' · ' + near.label : player.driving ? '下车' : player.nearCar ? '上车' : '靠近座驾上车';
    setText(actionText,context);
    action.disabled = !near && !player.driving && !player.nearCar;
    setText($('#port-speed'),String(Math.round(player.speed)));
    setText($('#port-transport'),player.driving ? '海风敞篷' : '步行');
    if(shownDrivingControls !== player.driving){
      shownDrivingControls=player.driving;
      $('#port-controls').innerHTML=player.driving
        ? '<kbd>W / S</kbd> 油门刹车 <span>·</span> <kbd>A / D</kbd> 转向'
        : '<kbd>WASD</kbd> 移动 <span>·</span> <kbd>Shift</kbd> 奔跑';
    }
    setText($('#port-district'),district());
    if(race.active && race.index) setText(phase,(race.elapsed/1000).toFixed(1) + ' s · ' + race.index + '/' + (race.total-1));
    window.CityMap.drawRadar(radar,player,markers);
  }
  function celebrate(label,title,copy,subject = '') {
    rewardSubject = subject;
    $('#port-reward-next').textContent = subject ? '答一道题赚金币' : '查看委托手机';
    $('#port-reward-label').textContent = label;
    $('#port-reward-title').textContent = title;
    $('#port-reward-text').textContent = copy;
    reward.hidden = false;
    window.CityAudio?.cue('complete');
    $('#port-reward-next').focus({preventScroll:true});
  }
  function arrival(marker) {
    const result = jobs.arrive(marker.id);
    if (result.type === 'wrong') {
      window.CityAudio?.cue('wrong');
      cityHint = result.message;
      renderTask(); toast(result.message);
      return;
    }
    if (!['progress','completed'].includes(result.type)) return;
    cityHint = '';
    if (result.type === 'completed') {
      const contract = contracts.find(j=>j.id===result.id);
      celebrate(result.fresh ? '委托完成 · 新车漆已解锁' : '再次完成委托',contract.title,
        (result.memory || result.message) + (result.fresh ? '　车库已加入「'+result.livery+'」。' : ''), contract.subject === 'mixed' ? '' : contract.subject);
    } else {
      window.CityAudio?.cue('pickup');
      toast(result.message,5500);
    }
    syncMarkers(); renderTask(); refreshHUD();
  }
  function interact() {
    if (!visible || paused) return;
    const marker = nearby();
    if (marker) return arrival(marker);
    if (engine?.interactVehicle()) {
      toast(player.driving ? '已上车。W 加速，S 刹车或倒车，A / D 转向。' : '已下车，可以步行探索。',2800);
      refreshHUD();
    }
  }
  function frame(snapshot) {
    player = snapshot;
    if (paused) return;
    const now = performance.now(), race = rally.snapshot();
    if(race.active){
      const event = rally.tick(player,now);
      if (event) {
        if (event.type === 'finish') {
          celebrate(event.fresh ? '海岸试车 · 个人纪录' : '海岸试车 · 完赛',window.CityRally.format(event.time),
            '个人最快 '+window.CityRally.format(event.best)+'。可以打开手机，再跑一圈。');
        } else {
          window.CityAudio?.cue('pickup');
          const split = event.delta === null ? '' : '　比个人纪录' + (event.delta <= 0 ? '快' : '慢') + window.CityRally.format(Math.abs(event.delta));
          toast(event.type === 'start' ? '计时开始！看下一道金色光门。' : '通过检查点！' + split,2300);
        }
        syncMarkers();renderTask();
      }
    }
    if(now - uiTime < 100) return;
    uiTime = now;
    refreshHUD();
    if (!race.active && reward.hidden && near && ['navigation','relay'].includes(near.kind) && lastAutoMark!==near.id) {
      lastAutoMark=near.id;arrival(near);
    } else if (!near) lastAutoMark=null;
    for (const place of places) {
      if(distance(player,place)>7.5) continue;
      const fresh=!prefs.discoveries.includes(place.id);
      if(fresh){prefs.discoveries.push(place.id);persist();}
      const pinned=personalPin?.id===place.id;
      if(pinned){personalPin=null;syncMarkers();renderTask();}
      if(fresh||pinned)toast((fresh?'发现地标 · ':'抵达 · ')+place.name,2600);
    }
  }
  const shopPaint = {id:'paint', livery:'霓虹玫红车漆', color:'#f5398d'};
  let appliedEngine = null, appliedColor = null, appliedShoes = null;
  function selectedPaint(inventory,completed) {
    if(inventory?.owned?.includes('paint') && inventory.equipped?.paint) return shopPaint;
    return completed.includes(prefs.paint) ? contracts.find(j=>j.id===prefs.paint) : null;
  }
  function applyEquipment(inventory=window.Game?.getState()) {
    if(!engine) return;
    const hex = selectedPaint(inventory,jobs.getState().completed)?.color || '#ee735e';
    const shoes = Boolean(inventory?.owned?.includes('shoes') && inventory.equipped?.shoes);
    if(engine!==appliedEngine || hex!==appliedColor) engine.setDrivingColor(hex);
    if(engine!==appliedEngine || shoes!==appliedShoes) engine.setRunningShoes(shoes);
    appliedEngine=engine;appliedColor=hex;appliedShoes=shoes;
  }
  window.Game?.subscribe(inventory=>{
    applyEquipment(inventory);
    if(visible && phone.open && app==='garage') renderPhone();
  });
  function enter() {
    if(visible) return;
    visible = true;
    document.body.classList.add('in-port');city.hidden=false;city.focus({preventScroll:true});
    if(!engine){
      const hooks = {onFrame:frame,onInteract:interact,onContextLost:()=>{
        if(method!=='3d')return;
        const last = {...player};
        method='software';
        engine?.dispose();scene.replaceChildren();
        engine=window.CityMap.createFallback(scene,{onFrame:frame,onInteract:interact,initialState:last});
        applyEquipment();setPaused();syncMarkers();renderTask();refreshHUD();
      }};
      try{engine=window.CityEngine.create(scene,hooks);}
      catch(error){
        console.info('Using the compatible city renderer.',error);
        method='software';
        scene.replaceChildren();
        engine=window.CityMap.createFallback(scene,{onFrame:frame,onInteract:interact});
      }
      if(!prefs.visited && !jobs.current() && !jobs.getState().completed.length) jobs.start('city-english');
      prefs.visited = true;persist();
    }
    applyEquipment();setPaused();syncMarkers();renderTask();refreshHUD();

  }
  function leave() {
    if(phone.open) phone.close();
    visible=false;setPaused();city.hidden=true;
    document.body.classList.remove('in-port');
    $('[data-city-open]').focus({preventScroll:true});
  }
  function openPhone(tab='jobs', opener=$('#port-phone-open')) {
    if(!visible)return;
    panelOpener = opener; app=tab;reward.hidden=true;
    if(!phone.open)phone.showModal();
    setPaused();renderPhone();
    phone.querySelector('[aria-current="true"]').focus({preventScroll:true});
  }
  function closePhone(){if(phone.open)phone.close();}
  function renderPhone() {
    const state=jobs.getState(), race=rally.snapshot(), current=jobs.current();
    phone.querySelectorAll('[data-app]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.app===app)));
    const body=$('#phone-body');
    if(app==='jobs'){
      body.innerHTML=(current||race.active?'<button class="phone-lower" data-cmd="free">收起任务，随意逛逛</button>':'')+
        '<button class="race-card" data-cmd="race"><small>街头活动 · 自愿计时</small><strong>海岸试车</strong><p>'+
        (race.active?'继续当前圈':race.best?'个人最快 '+window.CityRally.format(race.best)+'，再跑一圈。':'开车穿过四道光门，留下自己的第一条圈速。')+'</p></button>'+
        contracts.map(j=>{
          const unlocked=jobs.isUnlocked(j.id);
          const status=state.completed.includes(j.id)?'已完成 · 可重玩':current?.id===j.id?'进行中':state.checkpoints[j.id]?'可继续':unlocked?'可接取':'完成四科委托解锁';
          return '<button class="city-job" style="--tint:'+j.color+'" data-job="'+j.id+'" '+(unlocked?'':'disabled')+'><small>'+subjectNames[j.subject]+' · '+status+'</small><strong>'+esc(j.title)+'</strong><p>'+esc(j.brief)+'</p></button>';
        }).join('');
    } else if(app==='garage'){
      const inventory=window.Game?.getState();
      const paints=[{id:'',livery:'珊瑚红',color:'#ee735e'},shopPaint,...contracts];
      const currentId=selectedPaint(inventory,state.completed)?.id || '';
      body.innerHTML='<h3>海风敞篷 · 车漆</h3><p>完成学科委托解锁主题色，也可以在道具商店购买霓虹玫红。</p>'+paints.map(j=>{
        const isShopPaint=j.id===shopPaint.id;
        const can=isShopPaint?inventory?.owned?.includes('paint'):!j.id||state.completed.includes(j.id);
        const selected=currentId===j.id;
        const buyLink=isShopPaint && !can && window.HarborShop?.open;
        const label=selected?'已装备':can?'换上车漆':isShopPaint?'去道具商店购买':'完成「'+esc(j.title)+'」解锁';
        const control=buyLink?'data-buy-paint':'data-paint="'+j.id+'" aria-pressed="'+selected+'" '+(can?'':'disabled');
        return '<button class="garage-paint" style="--tint:'+j.color+'" '+control+'><i class="garage-chip"></i>'+esc(j.livery)+'<small>'+label+'</small></button>';
      }).join('');
    } else if(app==='cards'){
      body.innerHTML='<h3>城市记忆卡　'+state.memories.length+' / 4</h3>'+
        (state.memories.length?state.memories.map(m=>'<details class="port-card"><summary><small>'+subjectNames[m.subject]+' · 翻卡回忆</small><strong>'+esc(m.title)+'</strong>'+esc(recallPrompts[m.subject])+'</summary><p>'+esc(m.memory)+'</p><button class="phone-lower" data-job="'+m.id+'">带着这条知识再跑一单</button></details>').join(''):'<p>完成一份学科委托，就会在这里留下沿途用过的知识。</p>')+
        '<h3>地标印记　'+prefs.discoveries.length+' / 4</h3><p>'+places.map(p=>(prefs.discoveries.includes(p.id)?'◆ ':'◇ ')+p.name).join('　')+'</p>';
    } else {
      body.innerHTML='<canvas class="phone-map" width="360" height="360" aria-label="全城地图，北朝上"></canvas>'+
        (markers.length?markers.map((m,i)=>'<div class="map-key" style="--tint:'+m.color+'"><i></i>'+(i+1)+' · '+esc(m.label)+' · '+Math.round(distance(player,m))+' 米</div>').join(''):'<p>选择一个地标，把它标到你的地图上。</p>')+
        places.map(p=>'<button class="garage-paint" data-place="'+p.id+'">'+esc(p.name)+'<small>'+(personalPin?.id===p.id?'清除标记':'标记目的地')+'</small></button>').join('');
      window.CityMap.drawRadar(body.querySelector('canvas'),player,markers);
    }
  }
  function freePlay(){jobs.pause();rally.stop();cityHint='';syncMarkers();renderTask();}
  phone.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(b.dataset.app){app=b.dataset.app;renderPhone();return;}
    if(b.dataset.cmd==='free'){freePlay();closePhone();toast('已保存委托站点，可以自由探索。');return;}
    if(b.dataset.cmd==='race'){
      if(!rally.snapshot().active){jobs.pause();rally.start();cityHint='';personalPin=null;}
      syncMarkers();renderTask();closePhone();return;
    }
    if(b.dataset.job){
      if(jobs.current()?.id!==b.dataset.job)jobs.pause();
      rally.stop();jobs.start(b.dataset.job);cityHint='';personalPin=null;
      syncMarkers();renderTask();closePhone();return;
    }
    if(Object.hasOwn(b.dataset,'buyPaint')){
      closePhone();window.HarborShop.open('shop');return;
    }
    if(Object.hasOwn(b.dataset,'paint')){
      const chosen=b.dataset.paint, inventory=window.Game?.getState();
      if(chosen===shopPaint.id){
        if(!inventory?.owned?.includes('paint'))return;
        window.Game.equipItem('paint',true);
      } else {
        if(chosen && !jobs.getState().completed.includes(chosen))return;
        prefs.paint=chosen;persist();
        if(inventory?.equipped?.paint)window.Game.equipItem('paint',false);
      }
      applyEquipment();renderPhone();
      $('#phone-body [data-paint="'+chosen+'"]')?.focus();return;
    }
    if(b.dataset.place){
      const place=places.find(p=>p.id===b.dataset.place);
      personalPin=personalPin?.id===place.id?null:place;syncMarkers();renderTask();closePhone();return;
    }
  });
  phone.addEventListener('close',()=>{setPaused();if(visible)(panelOpener?.isConnected&&!panelOpener.closest('[hidden]')?panelOpener:city).focus({preventScroll:true});});
  $('#port-phone-close').onclick=closePhone;
  $('#port-phone-open').onclick=()=>openPhone();
  $('#port-radar-open').onclick=()=>openPhone('map',$('#port-radar-open'));
  $('#port-leave').onclick=leave;
  $('#port-action').onclick=interact;
  $('#port-hint').onclick=()=>{const h=jobs.hint();cityHint=h.message;syncMarkers();renderTask();};
  $('#port-reward-next').onclick=()=>{
    reward.hidden = true;
    city.focus({preventScroll:true});
    if (rewardSubject) window.HarborShop.open('quiz',rewardSubject);
    else openPhone('jobs',city);
  };
  $('#port-reward-dismiss').onclick=()=>{reward.hidden=true;city.focus();};
  $('#port-controls').onclick=e=>{const on=city.classList.toggle('show-pad');e.currentTarget.setAttribute('aria-pressed',String(on));};
  radio.onchange=()=>{audioReady=true;prefs.station=radio.value;persist();window.CityAudio?.setStation(radio.value);window.CityAudio?.unlock?.();city.focus({preventScroll:true});};
  $('[data-city-open]').onclick=enter;
  function releaseTouch(){
    heldPointers.forEach(({key,button})=>{engine?.setInput(key,false);button.classList.remove('held');});
    heldPointers.clear();
  }
  city.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{
      if(paused)return;
      e.preventDefault();button.setPointerCapture(e.pointerId);
      const key=button.dataset.move;heldPointers.set(e.pointerId,{key,button});button.classList.add('held');engine.setInput(key,true);
    });
    const stop=e=>{
      if(!heldPointers.delete(e.pointerId))return;
      const key=button.dataset.move;
      if(![...heldPointers.values()].some(p=>p.key===key)){engine?.setInput(key,false);button.classList.remove('held');}
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,stop));
  });
  window.addEventListener('blur',releaseTouch);
  window.addEventListener('keydown',e=>{
    if(!visible||$('#harbor-shop').open||e.ctrlKey||e.altKey||e.metaKey||e.repeat||e.target.matches?.('input,select,textarea'))return;
    if(e.code==='KeyM'){e.preventDefault();if(phone.open)closePhone();else openPhone('map');}
  });
  window.addEventListener('harbor-shop-visibility',setPaused);
  document.addEventListener('visibilitychange',setPaused);
  window.addEventListener('pagehide',()=>{rally.freeze();engine?.pause(true);window.CityAudio?.setPaused(true);});
  window.addEventListener('pageshow',setPaused);
  enter();
})();

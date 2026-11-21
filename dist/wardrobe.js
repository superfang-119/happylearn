/* Outfits use the same passed learning checkpoints as the island trail. */
(() => {
  'use strict';

  const outfits = [
    {id:'pathfinder', name:'见习探险家', src:'art/outfit-pathfinder.png', coat:'#c89652', cap:'#e9bd73', detail:'羽饰宽檐帽 · 帆布挎包'},
    {id:'courier', name:'晨光信使', src:'art/outfit-courier.png', coat:'#e87841', cap:'#ef8a41', detail:'飞翼便帽 · 密封信件'},
    {id:'starpilot', name:'星图领航员', src:'art/outfit-starpilot.png', coat:'#51638f', cap:'#8fa8ba', detail:'星纹船长帽 · 黄铜罗盘'},
    {id:'leafcloak', name:'绿野巡游者', src:'art/outfit-leafcloak.png', coat:'#367e67', cap:'#428268', detail:'新芽斗篷 · 绿晶手杖'}
  ];
  const subjects = [['english','英语'],['geography','地理'],['history','历史'],['chinese','语文']];
  const storageKey = 'happylearn.learning.outfit.v1';
  const find = id => outfits.find(item => item.id === id);
  const defaultLook = outfits[0];
  let stored = defaultLook.id;
  let writeFailed = false;
  let preview = defaultLook.id;
  let trigger = null;
  let dialog = null;
  let lastShown = null;

  try {
    stored = find(window.localStorage.getItem(storageKey))?.id || defaultLook.id;
  } catch (_) { /* Session-only dressing remains available. */ }

  function milestones() {
    const trail = window.LearnTrail?.snapshot?.();
    const round = trail ? null : window.LearnRound?.getTopicProgress?.();
    const groups = subjects.map(([id,name]) => {
      if (trail) {
        const item = trail.bySubject?.[id];
        const total = positiveInt(item?.total);
        const passed=Math.min(positiveInt(item?.passed),total);
        return {name,total,passed,foundationPassed:Math.min(6,item?.foundationPassed??passed)};
      }
      const rows = round?.bySubject?.[id];
      return {name, total:Array.isArray(rows) ? rows.length : 0,
        passed:Array.isArray(rows) ? rows.filter(row => row.status === 'passed').length : 0,
        foundationPassed:Array.isArray(rows) ? rows.slice(0,6).filter(row=>row.status==='passed').length : 0};
    });
    const ids = trail?.passedIds || round?.passed || [];
    const count = Math.max(Array.isArray(ids) ? new Set(ids).size : 0, ...groups.map(s => s.passed));
    const untouched = groups.filter(s => s.passed === 0);
    const nearest = groups.filter(s => s.total > 0)
      .sort((a,b) => b.foundationPassed-a.foundationPassed)[0];
    const full = Boolean(nearest && nearest.foundationPassed===6);
    return {
      pathfinder:{ready:true, goal:'启程赠礼', note:'随时可以穿上这套出发。'},
      courier:{ready:count >= 1, goal:'通过任意 1 关', note:count ? '你已完成第一次闯关。' : '再通过 1 个学习关卡即可解锁。'},
      starpilot:{ready:full, goal:'通过任意一科的前 6 个基础关', note:full ? '你已通过'+nearest.name+'的前 6 个基础关。'
        : nearest ? nearest.name+'基础关还差 '+(6-nearest.foundationPassed)+' 关，也可以选其他科目。' : '通过任意一科的前 6 个基础关即可解锁。'},
      leafcloak:{ready:untouched.length === 0, goal:'四科各通过 1 关', note:untouched.length ?
        '还差 '+untouched.length+' 科：'+untouched.map(s => s.name).join('、')+'。' : '你已经在四个科目中各迈出了第一步。'}
    };
  }

  function positiveInt(value) {
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  }

  function wearing(gates) {
    return gates[stored]?.ready ? find(stored) || defaultLook : defaultLook;
  }

  function avatar() {
    const {id,name,src,coat,cap} = wearing(milestones());
    return {id,name,src,coat,cap};
  }

  function notify() {
    const appearance = avatar();
    if (lastShown === appearance.id) return;
    lastShown = appearance.id;
    window.dispatchEvent(new CustomEvent('learn-outfit-change', {detail:appearance}));
  }

  function equip(id) {
    const gates = milestones();
    if (!find(id) || !gates[id].ready) return;
    stored = id;
    writeFailed = false;
    try { window.localStorage.setItem(storageKey, id); }
    catch (_) { writeFailed = true; }
    preview = id;
    notify();
    render();
    dialog.querySelector('[data-outfit="'+id+'"]')?.focus({preventScroll:true});
    dialog.querySelector('.wd-live').textContent = '已穿上'+find(id).name+'。'+
      (writeFailed ? '当前浏览器只会在本次打开期间保留装扮。' : '');
  }

  function render() {
    const gates = milestones(), active = wearing(gates);
    const item = find(preview) || active, gate = gates[item.id];
    const activeLook = item.id === active.id;
    const cards = outfits.map(look => {
      const ready = gates[look.id].ready;
      const status = active.id === look.id ? '已穿戴' : ready ? '可穿戴' : '待解锁';
      return '<button type="button" class="wd-card" data-outfit="'+look.id+'" aria-pressed="'+
        (item.id === look.id)+'"><img src="'+look.src+'" width="40" height="46" alt=""><span><strong>'+look.name+
        '</strong><small>'+gates[look.id].goal+'</small></span><em class="wd-status '+(ready?'wd-ready':'')+'">'+status+'</em></button>';
    }).join('');
    let button = '';
    if (!gate.ready) button = '<button type="button" class="wd-equip" disabled>尚未解锁</button>';
    else if (!activeLook) button = '<button type="button" class="wd-equip" data-wear="'+item.id+'">穿上这套</button>';
    else if (item.id !== defaultLook.id) button = '<button type="button" class="wd-equip wd-secondary" data-wear="'+defaultLook.id+'">卸下 · 换回初始装扮</button>';
    else button = '<button type="button" class="wd-equip" disabled>正在穿戴</button>';
    dialog.innerHTML = '<header class="wd-head"><h2 id="wardrobe-title">我的衣橱</h2>'+
      '<button type="button" class="wd-close" data-close-outfit aria-label="关闭衣橱">×</button></header>'+
      '<div class="wd-body"><section class="wd-detail" aria-label="时装试穿"><div class="wd-stage wd-'+item.id+'">'+
      '<div class="wd-plinth"></div><img src="'+item.src+'" alt="'+item.name+'全身造型" width="96" height="112"></div>'+
      '<h3>'+item.name+'</h3><p class="wd-props">'+item.detail+'</p><p class="wd-note">'+gate.note+'</p>'+button+
      '</section><div class="wd-list" role="group" aria-label="选择要试穿的时装">'+cards+
      '</div></div><p class="wd-live" role="status" aria-live="polite"></p>';
  }

  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); restoreFocus(); }
  }

  function restoreFocus() {
    if (dialog?.open) return;
    if (trigger?.isConnected) trigger.focus({preventScroll:true});
    trigger = null;
  }

  function open(opener) {
    const element = document.getElementById('learn-wardrobe');
    if (!element) return;
    if (dialog !== element) {
      dialog = element;
      dialog.addEventListener('close', restoreFocus);
      dialog.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) {
          if (event.target === dialog) {
            const bounds = dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) close();
          }
          return;
        }
        if (button.hasAttribute('data-close-outfit')) return close();
        if (button.hasAttribute('data-wear')) return equip(button.dataset.wear);
        if (find(button.dataset.outfit)) {
          preview = button.dataset.outfit;
          render();
          dialog.querySelector('[data-outfit="'+preview+'"]').focus({preventScroll:true});
        }
      });
    }
    trigger = opener?.focus ? opener : document.activeElement;
    preview = avatar().id;
    render();
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open','');
    }
    dialog.querySelector('[data-outfit="'+preview+'"]')?.focus({preventScroll:true});
  }

  function refresh() {
    notify();
    if (!dialog?.open) return;
    const button = document.activeElement, selected = button?.dataset?.outfit;
    const hadClose = button?.hasAttribute('data-close-outfit'), hadWear = button?.hasAttribute('data-wear');
    render();
    const selector = selected && find(selected) ? '[data-outfit="'+selected+'"]' : hadClose ?
      '[data-close-outfit]' : hadWear ? '[data-wear]' : '';
    if (selector) dialog.querySelector(selector)?.focus({preventScroll:true});
  }

  window.addEventListener('learn-trail-change', refresh);
  window.addEventListener('learn-topic-progress', () => {
    if (!window.LearnTrail) refresh();
  });
  window.addEventListener('storage', e => {
    if (e.key !== storageKey && e.key !== null) return;
    stored = find(e.newValue)?.id || defaultLook.id;
    refresh();
  });
  window.LearnWardrobe = {open, avatar};
})();

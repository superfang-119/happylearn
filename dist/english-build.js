/* Optional, reward-free sentence building after an English knowledge question. */
(() => {
  'use strict';
  const sessions=new Map();
  const mounted=new WeakMap();
  const wordKey=s=>s.toLowerCase().replace(/[.,!?]/g,'');
  function partsOf(model) {
    const explicit=Array.isArray(model.parts)?model.parts:null;
    const parts=explicit||model.en.trim().split(/\s+/);
    return parts.length>=3 && parts.length<=6 && parts.join(' ')===model.en ? parts : null;
  }
  function shuffled(parts) {
    const order=parts.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [order[i],order[j]]=[order[j],order[i]];
    }
    // A lucky shuffle must not present an already assembled sentence.
    if(order.every((idx,i)=>wordKey(parts[idx])===wordKey(parts[i])))order.push(order.shift());
    return order;
  }
  function mount(container,id) {
    if(!container)return;
    const model=window.LearnFacts?.[id]?.model;
    const parts=model&&partsOf(model);
    if(!id?.startsWith('en-')||!parts) {
      container.replaceChildren();container.hidden=true;mounted.delete(container);return;
    }
    if(mounted.get(container)===id)return;
    mounted.set(container,id);
    container.classList.add('eb-builder');container.hidden=false;
    const doc=container.ownerDocument;
    function el(tag,cls,label) {
      const node=doc.createElement(tag);
      if(cls)node.className=cls;
      if(label!==undefined)node.textContent=label;
      return node;
    }
    function button(cls,label,click) {
      const node=el('button',cls,label);node.type='button';node.addEventListener('click',click);return node;
    }
    function collapsed(moveFocus=false) {
      const launch=button('eb-launch','试着拼一句',()=>opened(true));
      launch.setAttribute('aria-expanded','false');
      container.replaceChildren(launch);
      if(moveFocus)launch.focus({preventScroll:true});
    }
    function newSession() {
      const state={order:shuffled(parts),accepted:[],misses:0};
      sessions.set(id,state);
      return state;
    }

    function opened(moveFocus=false) {
      const state=sessions.get(id)||newSession();
      const complete=state.accepted.length===parts.length;
      const box=el('section','eb-sheet');
      box.setAttribute('aria-label','英文拼句练习');
      const header=el('div','eb-header');
      const instruction=el('strong','','把这句话拼成英文');
      const hide=button('eb-hide','收起',()=>collapsed(true));
      hide.setAttribute('aria-label','收起拼句练习');
      header.append(instruction,hide);
      const chinese=el('p','eb-translation',model.zh);
      const built=el('p','eb-line',complete?model.en:parts.slice(0,state.accepted.length).join(' '));
      if(!built.textContent)built.textContent='点选下面的词块开始拼句';
      built.classList.toggle('eb-empty',!state.accepted.length);
      built.classList.toggle('eb-complete',complete);
      built.setAttribute('aria-label',complete?'完整英文句子':'已拼出的部分');
      if(state.accepted.length)built.lang='en';
      const live=el('p','eb-message',complete?'拼好了！':'');
      live.setAttribute('role','status');live.setAttribute('aria-live','polite');
      box.append(header,chinese,built);
      let first;
      if(!complete) {
        const pool=el('div','eb-pool');
        pool.setAttribute('role','group');pool.setAttribute('aria-label','待选英文词块');
        for(const idx of state.order) {
          if(state.accepted.includes(idx))continue;
          const chip=button('eb-chip',parts[idx],()=>{
            const expected=parts[state.accepted.length];
            if(wordKey(parts[idx])!==wordKey(expected)) {
              state.misses++;
              live.textContent=state.misses===1?'这个词块放在这里还不顺，再试一个。':'看词首提示：下一块以 '+expected[0]+' 开头。';
              return;
            }
            state.accepted.push(idx);state.misses=0;opened(true);
          });
          chip.lang='en';pool.append(chip);if(!first)first=chip;
        }
        box.append(pool,live);
        if(state.accepted.length)box.append(button('eb-back','撤回一块',()=>{state.accepted.pop();state.misses=0;opened(true);}));
      } else {
        const again=button('eb-back','再拼一次',()=>{newSession();opened(true);});
        box.append(live,again);first=again;
      }
      container.replaceChildren(box);
      if(moveFocus)first?.focus({preventScroll:true});
    }
    collapsed();
  }
  window.EnglishBuild=Object.freeze({mount});
})();

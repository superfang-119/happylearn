/* Released exam excerpts paired with original beginner-level applications. */
(() => {
  'use strict';
  const key = 'happylearn.exam-bridge.v1';
  const gaokao = 'https://img.gaokaozhitongche.com/resource/pdf/paper/202510/20251023023510_2LdFtx.pdf';
  const bridges = [
    {
      id: 'fj24-pronoun', title: '谁得到了帮助？', exam: '2024 福建中考 · 第 22 题',
      sourceUrl: 'https://jyj.fuzhou.gov.cn/zwgk/cswz/fzygzz/tzgg/202406/P020240621476563479575.pdf',
      sourceLabel: '福建省教育考试院原卷与答案 · 书页 25、37',
      original: {
        context: '选择填空，保留原题选项。',
        prompt: 'Using AI tools in the right way can help ___ to work better.',
        options: ['we', 'us', 'our'], answer: 'us',
        explain: 'help 后面接得到帮助的人。we 是主格，us 是宾格，our 表示“我们的”，因此这里选 us。'
      },
      transfer: {
        context: '你和好朋友在教室里。选出能指代小美的词。',
        prompt: 'Mei can’t find her pen. Can you help ___?',
        options: ['she', 'her', 'we'], answer: 'her',
        explain: '帮的是小美。she 做主语表示“她”，放在 help 后面，要换成宾格 her。'
      }
    },
    {
      id: 'bj23-month', title: '旅行约在哪个月？', exam: '2023 北京中考 · 第 2 题',
      sourceUrl: 'https://cdn.gaokzx.com/zixunzhan/202403/3b3ef4f9-893c-40ec-ae1d-43e868a33d8a.pdf',
      sourceLabel: '北京市原卷与参考解析 · 单项填空第 2 题',
      original: {
        context: '单项填空，保留原题选项。',
        prompt: 'It’s a good idea to visit Beijing ___ October.',
        options: ['at', 'on', 'in', 'to'], answer: 'in',
        explain: 'October 单独表示十月，月份前用 in。说到具体某一天时，才换用 on。'
      },
      transfer: {
        context: '看校园活动通知，选择合适的时间介词。',
        prompt: 'Our class picnic is ___ May 12.',
        options: ['in', 'at', 'on'], answer: 'on',
        explain: 'May 12 指 5 月 12 日这一天，所以用 on。去掉 12 只剩 May 时，才用 in。'
      }
    },
    {
      id: 'gaokao23-their', title: '汤汁是谁的？', exam: '2023 高考新课标全国Ⅰ卷 · 第 62 题',
      sourceUrl: gaokao, sourceLabel: '新课标全国Ⅰ卷原卷与参考答案 · 语法填空第 62 题',
      original: {
        context: '语法填空原文节选。作者谈吃小笼包时如何避免洒出里面的汤汁。按括号中所给词的正确形式填空。',
        prompt: '… spilling any of ___ (they) contents.', answer: 'their',
        explain: 'contents 指小笼包里的东西，前面要说“它们的”。they 表示“它们”，放在名词前表示所属关系时写 their。'
      },
      transfer: {
        context: '帮队友补全失物招领卡，用括号里单词的正确形式填空。',
        prompt: 'Ben and I found ___ (we) bags under the desk.', answer: 'our',
        explain: 'bags 是名词，前面要说“我们的”。把 we 换成表示所属的 our，写成 our bags。'
      }
    },
    {
      id: 'gaokao23-article', title: '这一点甜味', exam: '2023 高考新课标全国Ⅰ卷 · 第 63 题',
      sourceUrl: gaokao, sourceLabel: '新课标全国Ⅰ卷原卷与参考答案 · 语法填空第 63 题',
      original: {
        context: '语法填空原文节选。作者说好的小笼包肉馅新鲜、略带甜味。填入一个合适的词。',
        prompt: '… with ___ touch of sweetness …', answer: 'a',
        explain: 'a touch of 是“一点点”的常见表达。touch 以辅音开头，这里用 a。'
      },
      transfer: {
        context: '早餐摊要给一位同学准备水果，用 a 或 an 填空。',
        prompt: 'I would like ___ apple for breakfast.', answer: 'an',
        explain: '这里要一个苹果。apple 开头是元音音素，所以在单数可数名词 apple 前写 an。'
      }
    }
  ];
  const byId = new Map(bridges.map(bridge => [bridge.id, bridge]));
  const phases = ['transfer','original'];
  const phaseNames = { original: '真题原题', transfer: '初一同考点' };
  const statusNames = { unseen: '未练', wrong: '待再练', correct: '最近答对' };
  let records = {}, cache = null, canStore = true, dialog = null, opener = null, view = null;

  function dateKey() {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function load() {
    if (!canStore) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw === cache) return;
      cache = raw;
      records = {};
      const saved = JSON.parse(raw);
      for (const {id} of bridges) for (const phase of phases) {
        const v = saved?.[id]?.[phase];
        if (v && ['wrong','correct'].includes(v.result) && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
          (records[id] ||= {})[phase] = {result:v.result,date:v.date};
        }
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) canStore=false;
    }
  }
  function getRows() {
    load();
    return bridges.map(({id,title,exam,sourceUrl}) => ({
      id,title,exam,sourceUrl,original:records[id]?.original?.result || 'unseen',
      transfer:records[id]?.transfer?.result || 'unseen',originalDate:records[id]?.original?.date || null,
      transferDate:records[id]?.transfer?.date || null
    }));
  }
  const safe = value => String(value).replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function button(label,act,id='',phase='',primary=false) {
    return '<button type="button" class="eb-button'+(primary?' eb-primary':'')+'" data-eb="'+act+'" data-id="'+id+'" data-phase="'+phase+'">'+safe(label)+'</button>';
  }
  function ensureDialog() {
    if (dialog) return;
    dialog=document.getElementById('exam-bridge-dialog');
    if (!dialog) {
      dialog=document.createElement('dialog');
      dialog.id='exam-bridge-dialog';
      document.body.appendChild(dialog);
    }
    dialog.setAttribute('aria-labelledby','eb-heading');
    dialog.addEventListener('click',event=>{
      if(event.target===dialog){
        const b=dialog.getBoundingClientRect();
        if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();
        return;
      }
      const target=event.target.closest('[data-eb]');
      if(!target)return;
      const {eb,id,phase}=target.dataset;
      if(eb==='close'){dialog.close();return;}
      if(eb==='list'){view={};render();return;}
      if(eb==='practice'&&byId.has(id)&&phases.includes(phase)){
        view={id,phase};render();
      }
    });
    dialog.addEventListener('submit',event=>{
      event.preventDefault();
      const form=event.target;
      if(!form.matches('[data-eb-form]')||!view?.id||view.feedback)return;
      const response=String(form.elements.answer?.value || '').normalize('NFKC').trim().toLowerCase();
      if(!response){
        const notice=dialog.querySelector('[data-eb-notice]');
        if(notice)notice.textContent='先填入或选择一个答案。';
        return;
      }
      const b=byId.get(view.id),phase=view.phase,q=b[phase];
      if(q.options&&!q.options.includes(response))return;
      const result=response===q.answer?'correct':'wrong';
      load(); (records[b.id] ||= {})[phase]={result,date:dateKey()};
      if(canStore){
        try{const raw=JSON.stringify(records);localStorage.setItem(key,raw);cache=raw;}catch{canStore=false;}
      }
      view.feedback={result};
      try{
        window.LearnJournal?.record?.({source:'exam',id:b.id+'-'+phase,subject:'english',
          title:b.title+' · '+phaseNames[phase],outcome:result,note:q.explain,
          example:q.prompt.replace('___',q.answer).replace(/\s*\([a-z]+\)/g,'')});
      }catch{/* The exercise still works when journal storage is unavailable. */}
      render();
    });
    dialog.addEventListener('close',()=>{
      view=null;
      if(opener?.isConnected)opener.focus({preventScroll:true});
      opener=null;
      if(typeof window.CustomEvent==='function')window.dispatchEvent(new CustomEvent('exambridge:change'));
    });
  }
  function render() {
    const rows=getRows();
    const b=byId.get(view?.id);
    let body='',heading='中高考真题',eyebrow='英语 · 提分专项';
    if(!b){
      body='<p class="eb-intro">同一个知识点可以从初一小题起步，再试一次真实考题。</p><div class="eb-catalog">'+rows.map(r=>
        '<section class="eb-entry"><small>'+safe(r.exam)+'</small><h3>'+safe(r.title)+'</h3><div class="eb-actions">'+
        phases.map(p=>button(phaseNames[p]+' · '+statusNames[r[p]],'practice',r.id,p,p==='transfer')).join('')+
        '</div></section>').join('')+'</div>';
    }else{
      const phase=view.phase,q=b[phase],row=rows.find(r=>r.id===b.id),other=phase==='original'?'transfer':'original';
      heading=b.title;eyebrow=b.exam;
      const top='<div class="eb-switch" aria-label="练习环节">'+phases.map(p=>p===phase?
        '<span aria-current="step">'+phaseNames[p]+'</span>':button(phaseNames[p],'practice',b.id,p)).join('')+'</div>';
      body=top+'<p class="eb-context">'+safe(q.context)+'</p><p class="eb-question" lang="en">'+safe(q.prompt)+'</p>';
      if(view.feedback){
        const correct=view.feedback.result==='correct';
        body+='<div class="eb-feedback'+(correct?' eb-correct':'')+'" role="status" tabindex="-1" data-eb-feedback><strong>'+
          (correct?'答对了。':'再看一眼这个用法。')+'</strong> 正确答案 <b lang="en">'+safe(q.answer)+'</b><p>'+safe(q.explain)+'</p></div>'+
          '<div class="eb-actions">'+button('再练这题','practice',b.id,phase)+
          button('试试'+phaseNames[other],'practice',b.id,other,true)+'</div>';
      }else{
        body+='<form data-eb-form><fieldset><legend>'+(q.options?'选择答案':'填写答案')+'</legend>'+
          (q.options?q.options.map((v,i)=>'<label class="eb-radio"><input type="radio" name="answer" value="'+safe(v)+'"> <span>'+String.fromCharCode(65+i)+'. '+safe(v)+'</span></label>').join(''):
            '<label class="eb-write">英文单词<input name="answer" type="text" lang="en" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="off"></label>')+
          '</fieldset><p role="status" data-eb-notice></p><button type="submit" class="eb-button eb-primary">核对答案</button></form>';
      }
      body+='<footer class="eb-source"><span>'+phaseNames[phase]+' · '+statusNames[row[phase]]+
        (row[phase+'Date']?' · '+row[phase+'Date']:'')+'</span><a href="'+b.sourceUrl+'" target="_blank" rel="noopener noreferrer">'+
        safe(b.sourceLabel)+'</a></footer>'+button('返回真题目录','list');
    }
    dialog.innerHTML='<div class="eb-inner"><header class="eb-head"><div><small>'+safe(eyebrow)+'</small><h2 id="eb-heading" tabindex="-1">'+
      safe(heading)+'</h2></div>'+button('关闭','close')+'</header>'+body+'</div>';
    (dialog.querySelector('[data-eb-feedback]')||dialog.querySelector('#eb-heading'))?.focus({preventScroll:true});
    dialog.scrollTop=0;
  }
  function open(from,id,phase='transfer') {
    ensureDialog();
    if(!dialog.open){opener=from || document.activeElement;dialog.showModal();}
    view=byId.has(id)?{id,phase:phases.includes(phase)?phase:'transfer'}:{};
    render();
  }
  window.ExamBridge=Object.freeze({open,getRows});
})();

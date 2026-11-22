/* The report reads each practice engine's recorded evidence. Navigation is opt-in. */
(() => {
  'use strict';
  const dialog = document.getElementById('mastery-dialog');
  if (!dialog) return;

  const subjects = {english:'英语', geography:'地理', history:'历史', chinese:'语文'};
  const art = {english:'art/english.png', geography:'art/geography.png', history:'art/history.png', chinese:'art/chinese.png'};
  const stages = {primary:'小学起步', junior:'初中衔接'};
  const labels = {unseen:'未学', learning:'练习中', independent:'独立答对', review:'待复习', retained:'已巩固'};
  const units = {topic:'知识点', word:'单词', skill:'专项'};
  const pageSize = 6;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);

  let subject = 'english', englishView = 'topic', status = 'all', stage = 'all', query = '', page = 0;
  let opener = null, rows = {topic:[], word:[], skill:[], exam:[]}, visibleRows = [], pendingWords = new Set();
  const view = () => subject === 'english' ? englishView : 'topic';
  const statusLabel = (kind, code) => kind === 'skill' && code === 'unseen' ? '未测' : labels[code];
  const actualStatus = row => Object.hasOwn(labels, row.status) ? row.status : 'unseen';

  dialog.innerHTML = '<header class="mr-header"><div class="mr-emblem" aria-hidden="true"><img src="art/english.png" alt=""></div>'+
    '<div><h2 id="mastery-title" tabindex="-1">我的学情</h2><p>这台设备上的学习记录</p></div>'+
    '<button type="button" class="mr-close" data-mr="close" aria-label="关闭我的学情">×</button></header>'+
    '<div class="mr-scroll"><section class="mr-overview" aria-labelledby="mr-overview-title">'+
    '<div class="mr-overview-heading"><h3 id="mr-overview-title">学习总览</h3><span class="mr-coverage"></span></div>'+
    '<dl class="mr-counts"></dl><p class="mr-skill-summary"></p></section>'+
    '<div class="mr-tools"><div class="mr-subjects" role="group" aria-label="选择学科">'+
    Object.entries(subjects).map(([id,name]) => '<button type="button" data-mr-subject="'+id+'"><img src="'+art[id]+'" alt="">'+name+'</button>').join('')+
    '</div><div class="mr-views" role="group" aria-label="英语学习内容">'+
    [['topic','知识点'],['word','单词'],['skill','提分专项']].map(([id,name])=>'<button type="button" data-mr-view="'+id+'">'+name+'</button>').join('')+
    '</div><div class="mr-skill-tools" hidden><button class="mr-check" type="button" data-mr="check">开始 5 题小测</button></div>'+
    '<div class="mr-filters"><label>学习状态<select data-mr-status></select></label>'+
    '<label class="mr-word-control" hidden>词汇学段<select data-mr-stage><option value="all">全部学段</option>'+
    Object.entries(stages).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')+
    '</select></label><button class="mr-journal" type="button" data-mr="journal">按日期看讲解</button></div><label class="mr-search mr-word-control" hidden><span>查找单词</span>'+
    '<input data-mr-search type="search" maxlength="80" placeholder="输入英文或中文" autocomplete="off" autocapitalize="none" spellcheck="false"></label>'+
    '<p class="mr-private" hidden>正在回想的单词暂时收起，提交后可查看。</p></div>'+
    '<section class="mr-list-area" aria-labelledby="mr-list-title"><div class="mr-list-heading"><h3 id="mr-list-title" tabindex="-1"></h3>'+
    '<span class="mr-range" aria-live="polite" aria-atomic="true"></span></div><ul class="mr-list"></ul>'+
    '<div class="mr-empty" hidden><p></p><button type="button" data-mr="reset" hidden>清除筛选</button></div>'+
    '<nav class="mr-pages" aria-label="学情清单分页" hidden><button type="button" data-mr="prev">上一页</button><span></span>'+
    '<button type="button" data-mr="next">下一页</button></nav><p class="mr-explanation">“已巩固”表示曾在不同日期独立答对。到复习日后，可以再试一次。</p>'+
    '<p class="mr-message" role="status" aria-live="polite"></p></section>'+
    '<section class="mr-exams" aria-labelledby="mr-exams-title" hidden><h3 id="mr-exams-title">中高考真题</h3>'+
    '<p>同一考点有真题和七上变式，两次作答分别记录。</p><ul class="mr-exam-list"></ul></section></div>';

  const find = selector => dialog.querySelector(selector);
  const list = find('.mr-list'), range = find('.mr-range'), heading = find('#mr-list-title');
  const statusSelect = find('[data-mr-status]'), stageSelect = find('[data-mr-stage]'), search = find('[data-mr-search]');
  const message = find('.mr-message');

  function readRows() {
    const source = {
      topic:window.LearnRound?.getMasteryRows?.(),
      word:window.WordPractice?.getMasteryRows?.(),
      skill:window.MasteryPractice?.skills?.(),
      exam:window.ExamBridge?.getRows?.()
    };
    for (const kind of Object.keys(source)) {
      rows[kind] = Array.isArray(source[kind]) ? source[kind].filter(row=>row && row.id != null) : [];
    }
    const pending=window.WordPractice?.getPendingRecallWords?.();
    pendingWords=new Set(Array.isArray(pending) ? pending.map(word=>String(word).toLowerCase()) : []);
  }

  function renderOverview() {
    const core = [...rows.topic, ...rows.word];
    find('.mr-coverage').textContent = rows.topic.length+' 个知识点 · '+rows.word.length+' 个单词';
    find('.mr-counts').innerHTML = ['unseen','learning','review','independent','retained'].map(code=>
      '<div data-tone="'+code+'"><dt>'+labels[code]+'</dt><dd>'+core.filter(row=>actualStatus(row)===code).length+'</dd></div>'
    ).join('');
    const summary = find('.mr-skill-summary');
    summary.hidden = !rows.skill.length;
    if (!summary.hidden) {
      const tried = rows.skill.filter(row=>actualStatus(row)!=='unseen').length;
      summary.textContent = '英语提分专项另外记录，已测 '+tried+' / '+rows.skill.length+' 项';
    }
  }

  function chooseControls() {
    const kind = view();
    for (const button of dialog.querySelectorAll('[data-mr-subject]')) {
      button.setAttribute('aria-pressed',String(button.dataset.mrSubject===subject));
    }
    find('.mr-views').hidden = subject!=='english';
    for (const button of dialog.querySelectorAll('[data-mr-view]')) {
      button.setAttribute('aria-pressed',String(button.dataset.mrView===kind));
    }
    find('.mr-skill-tools').hidden = kind!=='skill' || !rows.skill.length;
    for (const item of dialog.querySelectorAll('.mr-word-control')) item.hidden=kind!=='word';
    find('.mr-private').hidden=kind!=='word' || !pendingWords.size;
    const unseen = statusLabel(kind,'unseen');
    if (statusSelect.dataset.unseen!==unseen) {
      statusSelect.innerHTML = '<option value="all">全部状态</option>'+Object.keys(labels).map(code=>
        '<option value="'+code+'">'+statusLabel(kind,code)+'</option>'
      ).join('');
      statusSelect.dataset.unseen=unseen;
    }
    statusSelect.value=status;
    stageSelect.value=stage;
    if (search.value!==query) search.value=query;
  }

  function itemDate(label,date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '';
    return '<span>'+label+' <time datetime="'+date+'">'+date+'</time></span>';
  }

  function rowMarkup(row,index,kind) {
    const code=actualStatus(row), name=kind==='word' ? row.word || row.title : row.title;
    const stageName=kind==='word' ? stages[row.stage] : '';
    const dates=itemDate('最近练习',row.lastDate)+itemDate('复习日',row.dueDate);
    const evidence=typeof row.evidence==='string' ? row.evidence : '';
    const locked=kind==='topic' && row.available===false;
    const verb=code==='review' ? '去复习' : code==='unseen' && kind==='skill' ? '去测一测' : '去练习';
    const control=locked ? '<span class="mr-locked" title="先完成本学科的前一关">前一关通关后开放</span>' :
      '<button type="button" class="mr-practice" data-mr-row="'+index+'" aria-label="'+escape(verb+'，'+name)+'">'+verb+'<span aria-hidden="true"> ›</span></button>';
    return '<li class="mr-row"><div class="mr-row-main"><div class="mr-row-title"><strong'+(kind==='word'?' lang="en"':'')+'>'+escape(name)+'</strong>'+
      '<span class="mr-status mr-s-'+code+'">'+statusLabel(kind,code)+'</span></div>'+
      (kind==='word'?'<p class="mr-definition">'+escape(row.zh || '')+(stageName?'<span>'+stageName+'</span>':'')+'</p>':'')+
      (evidence?'<p class="mr-evidence"><span>依据</span> '+escape(evidence)+'</p>':'')+
      (dates?'<div class="mr-dates">'+dates+'</div>':'')+'</div>'+control+'</li>';
  }

  function renderList() {
    const kind=view();
    let candidates=rows[kind];
    if (kind==='topic') candidates=candidates.filter(row=>row.subject===subject);
    if (kind==='word') candidates=candidates.filter(row=>![row.id,row.word].some(value=>value && pendingWords.has(String(value).toLowerCase())));
    const term=query.trim().toLowerCase();
    const selected=candidates.filter(row=>(status==='all' || actualStatus(row)===status) &&
      (kind!=='word' || ((stage==='all'||row.stage===stage) &&
      (!term||[row.word,row.zh,row.title].some(value=>String(value||'').toLowerCase().includes(term))))));
    const pageCount=Math.ceil(selected.length/pageSize);
    page=Math.max(0,Math.min(page,pageCount-1));
    const first=page*pageSize;
    visibleRows=selected.slice(first,first+pageSize);
    heading.textContent=subjects[subject]+(kind==='skill'?'提分专项':units[kind]+'清单');
    range.textContent=selected.length ? (pageCount>1 ? (first+1)+'–'+(first+visibleRows.length)+' / '+selected.length+' 项' : '共 '+selected.length+' 项') : '0 项';
    list.innerHTML=visibleRows.map((row,index)=>rowMarkup(row,index,kind)).join('');
    const empty=find('.mr-empty');
    empty.hidden=Boolean(selected.length);
    if (!empty.hidden) {
      empty.querySelector('p').textContent=candidates.length ? '没有符合筛选条件的'+units[kind]+'。' : '暂时没有可显示的'+units[kind]+'记录。';
      find('[data-mr="reset"]').hidden=!candidates.length;
    }
    find('.mr-pages').hidden=pageCount<=1;
    find('.mr-pages span').textContent=(page+1)+' / '+pageCount;
    find('[data-mr="prev"]').disabled=page===0;
    find('[data-mr="next"]').disabled=page+1>=pageCount;
    const exams=find('.mr-exams');
    exams.hidden=kind!=='skill';
    if (!exams.hidden) {
      const outcomes={unseen:'未做',wrong:'需再练',correct:'答对'};
      const examOutcome=(label,code,date)=>'<span><b>'+label+'</b> '+(outcomes[code]||'未做')+
        (/^\d{4}-\d{2}-\d{2}$/.test(date||'')?' <time datetime="'+date+'">'+date+'</time>':'')+'</span>';
      find('.mr-exam-list').innerHTML=rows.exam.length ? rows.exam.map((exam,index)=>{
        const source=/^https?:\/\//i.test(exam.sourceUrl || '') ? '<a href="'+escape(exam.sourceUrl)+'" target="_blank" rel="noopener noreferrer">题源<span class="mr-sr">（在新窗口打开）</span></a>' : '';
        return '<li class="mr-exam"><div><p class="mr-exam-source">'+escape(exam.exam)+' '+source+'</p><strong>'+escape(exam.title)+'</strong>'+
          '<div class="mr-exam-outcomes">'+examOutcome('真题',exam.original,exam.originalDate)+examOutcome('七上变式',exam.transfer,exam.transferDate)+'</div></div>'+
          '<button type="button" class="mr-practice" data-mr-exam="'+index+'" aria-label="'+escape('练习'+exam.title)+'">做题<span aria-hidden="true"> ›</span></button></li>';
      }).join('') : '<li class="mr-empty">暂时没有真题记录。</li>';
    }
  }

  function refresh() {
    if (!dialog.open) return;
    readRows();
    renderOverview();
    chooseControls();
    renderList();
  }

  function resetFilters() {
    status='all'; stage='all'; query=''; page=0;
    message.textContent='';
  }

  function open(trigger) {
    if (!dialog.open) {
      opener=trigger?.focus ? trigger : document.activeElement;
      dialog.showModal();
    }
    refresh();
    find('.mr-scroll').scrollTop=0;
    find('#mastery-title').focus({preventScroll:true});
  }

  function launch(kind,row) {
    const practice=window.MasteryPractice;
    if (typeof practice?.[kind]!=='function') {
      message.textContent='暂时打不开练习。可以先查看其他学习记录。';
      return;
    }
    const returnTo=opener;
    opener=null;
    dialog.close();
    if (kind==='topic') practice.topic(row.id);
    else if (kind==='word') practice.word(row.id,row.stage,returnTo);
    else if (kind==='skill' || kind==='exam') practice[kind](row.id,returnTo);
    else practice[kind](returnTo);
  }

  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button || button.disabled || !dialog.contains(button)) return;
    if (button.dataset.mrSubject) {
      if (subject!==button.dataset.mrSubject) {
        subject=button.dataset.mrSubject; resetFilters(); chooseControls(); renderList();
      }
      return;
    }
    if (button.dataset.mrView) {
      if (englishView!==button.dataset.mrView) {
        englishView=button.dataset.mrView; resetFilters(); chooseControls(); renderList();
      }
      return;
    }
    if (button.hasAttribute('data-mr-row')) {
      const row=visibleRows[Number(button.dataset.mrRow)];
      if (row) launch(view(),row);
      return;
    }
    if (button.hasAttribute('data-mr-exam')) {
      const exam=rows.exam[Number(button.dataset.mrExam)];
      if (exam) launch('exam',exam);
      return;
    }
    const action=button.dataset.mr;
    if (action==='close') dialog.close();
    else if (action==='check' || action==='journal') launch(action);
    else if (action==='reset') { resetFilters(); chooseControls(); renderList(); statusSelect.focus(); }
    else if (action==='prev'||action==='next') {
      page+=action==='next'?1:-1;
      renderList();
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'nearest'});
    }
  });

  dialog.addEventListener('change',event=>{
    if (event.target===statusSelect) status=statusSelect.value;
    else if (event.target===stageSelect) stage=stageSelect.value;
    else return;
    page=0; message.textContent=''; renderList();
  });
  search.addEventListener('input',()=>{
    query=search.value; page=0; message.textContent=''; renderList();
  });
  dialog.addEventListener('close',()=>{
    if (dialog.open) return;
    const target=opener;
    opener=null;
    if (target?.isConnected && !target.closest?.('[hidden],dialog:not([open])')) target.focus({preventScroll:true});
  });
  window.addEventListener('storage',refresh);
  window.addEventListener('vocab-progress',refresh);
  window.addEventListener('exambridge:change',refresh);
  window.addEventListener('learn-topic-progress',refresh);
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) refresh(); });
  window.MasteryReport=Object.freeze({open,refresh});
})();

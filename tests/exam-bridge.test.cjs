const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../dist/exam-bridge.js'),'utf8');
function visit(store=new Map(),blocked=false){
  const listeners={},journal=[],notice={textContent:''},wallet={payments:0};
  const dialog={open:false,innerHTML:'',addEventListener:(k,v)=>{listeners[k]=v;},
    querySelector:sel=>sel==='[data-eb-notice]'?notice:{focus(){}},setAttribute(){},
    showModal(){this.open=true;}, close(){this.open=false;listeners.close();}};
  const opener={isConnected:true,count:0,focus(){this.count++;}};
  const window={LearnJournal:{record:e=>journal.push(e)},Game:wallet};
  const document={createElement:()=>dialog,getElementById:()=>null,body:{appendChild(){}},activeElement:opener};
  const localStorage={getItem:k=>store.get(k)??null,setItem(k,v){if(blocked)throw Error('full');store.set(k,v);}};
  vm.runInNewContext(src,{window,document,localStorage});
  const api=window.ExamBridge;
  const click=(eb,id,phase)=>listeners.click({target:{closest:()=>({dataset:{eb,id,phase}})}});
  const submit=value=>listeners.submit({preventDefault(){},target:{matches:()=>true,elements:{answer:{value}}}});
  return {api,dialog,store,journal,notice,opener,click,submit};
}

test('four verified bridges expose independent dated statuses and both original school levels',()=>{
  const {api,store}=visit();
  const rows=api.getRows();
  assert.equal(rows.length,4);
  assert.equal(new Set(rows.map(x=>x.id)).size,4);
  assert.equal(rows.filter(x=>x.exam.includes('中考')).length,2);
  assert.equal(rows.filter(x=>x.exam.includes('高考')).length,2);
  assert.ok(rows.every(x=>x.original==='unseen'&&x.transfer==='unseen'&&x.originalDate===null&&x.transferDate===null&&x.sourceUrl.startsWith('https://')));
  assert.equal(store.size,0);
  rows[0].original='wrong';assert.equal(api.getRows()[0].original,'unseen');
});

test('direct open, answer, review wrong, retry later and restore without displaying a solution before submission',()=>{
  const s=visit(),id='fj24-pronoun',row=()=>s.api.getRows().find(r=>r.id===id);
  s.api.open(s.opener,id,'original');
  assert.match(s.dialog.innerHTML,/Using AI tools/);assert.match(s.dialog.innerHTML,/福建省教育考试院/);
  assert.ok(!s.dialog.innerHTML.includes('正确答案'));assert.equal(s.journal.length,0);
  s.submit('');assert.match(s.notice.textContent,/选择/);assert.equal(row().original,'unseen');
  s.submit('we');assert.equal(row().original,'wrong');assert.match(s.dialog.innerHTML,/正确答案/);
  s.submit('us');assert.equal(row().original,'wrong');assert.equal(s.journal.length,1);
  s.click('practice',id,'original');assert.ok(!s.dialog.innerHTML.includes('正确答案'));
  s.submit('us');assert.equal(row().original,'correct');assert.match(row().originalDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(row().transfer,'unseen');
  s.click('practice',id,'transfer');s.submit('her');assert.equal(row().transfer,'correct');
  const other=visit(s.store);other.api.open(other.opener,id,'transfer');
  assert.ok(!other.dialog.innerHTML.includes('正确答案'));
  other.submit('we');assert.equal(other.api.getRows()[0].transfer,'wrong');
  assert.equal(s.api.getRows()[0].transfer,'wrong');
  assert.ok(s.journal.every(e=>e.subject==='english'&&e.source==='exam'&&e.note&&e.example));
  assert.deepEqual(s.journal.map(e=>e.id),[id+'-original',id+'-original',id+'-transfer']);
  s.click('close');assert.equal(s.opener.count,1);
});

test('month preposition, short national exam excerpts and beginner transfer work offline with free responses',()=>{
  const s=visit(new Map(),true);
  const values=[['bj23-month','in','on'],['gaokao23-their','their','our'],['gaokao23-article','a','an']];
  for(const [id,original,transfer] of values){
    s.api.open(s.opener,id,'original');
    if(id.startsWith('gaokao'))assert.match(s.dialog.innerHTML,/type="text"/);
    s.submit(original.toUpperCase());assert.equal(s.api.getRows().find(r=>r.id===id).original,'correct');
    s.click('practice',id,'transfer');
    assert.ok(!s.dialog.innerHTML.includes('正确答案'));s.submit(transfer);
    assert.equal(s.api.getRows().find(r=>r.id===id).transfer,'correct');
  }
  s.api.open(s.opener);assert.match(s.dialog.innerHTML,/最近答对/);
  assert.equal(s.store.size,0);assert.equal(s.journal.length,6);
});

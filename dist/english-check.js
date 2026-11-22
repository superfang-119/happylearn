/* Original beginner English checks. The answer key never enters an unanswered question snapshot. */
(() => {
  'use strict';
  const skills={listening:'单词听辨',spelling:'词汇拼写',grammar:'句子语法',reading:'短篇读信息',writing:'句子表达'};
  const skillIds=Object.keys(skills),bank=[];
  function add(skill,data){bank.push({...data,id:'ec-'+skill+'-'+(bank.filter(q=>q.skill===skill).length+1),skill});}
  for(const [word,topic,options,correct,explain] of [
    ['ruler','学习用品',['直尺','时钟','课桌'],0,'ruler 是直尺。要量练习本的长度，可以拿一把 ruler。'],
    ['borrow','借与还',['归还','借入','邀请'],1,'borrow 表示向别人借来东西。May I borrow your pen? 是在问“我能借你的笔吗？”'],
    ['thirsty','身体感受',['饿的','累的','口渴的'],2,'thirsty 表示口渴。I am thirsty. 说话的人想喝水。'],
    ['library','校园地点',['食堂','图书馆','操场'],1,'library 是图书馆。You can read books in the library.'],
    ['before','时间先后',['在……之前','在……之后','在……期间'],0,'before 指在某个时间之前。before lunch 就是午饭前。'],
    ['quiet','课堂用语',['安静的','寒冷的','兴奋的'],0,'quiet 是安静的。Please be quiet. 是请大家保持安静。'],
    ['across','动作方向',['向左转','穿过，到对面','在附近'],1,'across 描述从一边到另一边。walk across the road 是走到马路对面。'],
    ['umbrella','日常物品',['手套','围巾','雨伞'],2,'umbrella 是雨伞。下雨时可以 take an umbrella。']
  ])add('listening',{type:'choice',topic,audioWord:word,prompt:'听一听，录音里的单词是什么意思？',options,correct,explain});
  for(const [topic,prompt,key,explain] of [
    ['校园物品','把“钢笔”写在文具标签上。请填 p 开头的三个字母。','pen','钢笔是 pen。pencil 是铅笔，比 pen 多三个字母。'],
    ['星期名称','课表上要写“星期一”的英文全称。','Monday','星期一写作 Monday。英语的星期名称通常首字母大写。'],
    ['家庭成员','“我的兄弟”是 my ____。请写 b 开头、表示“兄弟”的一个词。','brother','brother 可以指哥哥或弟弟。brother 中间有 th。'],
    ['学科名称','给“科学”课本贴英文标签。请写 s 开头的学科名。','science','科学是 science，开头的三个字母是 sci。'],
    ['数字','柜门号是 20。请把“二十”写成一个英文单词。','twenty','20 写作 twenty。词尾是 ty，和表示“十二”的 twelve 不同。'],
    ['校园地点','“学校图书馆”是 school ____。请写 l 开头的单词。','library','图书馆写作 library。可以分成 li、bra、ry 三段检查拼写。'],
    ['常见颜色','班旗是蓝色的。“蓝色”用哪个 b 开头的四字母单词表示？','blue','蓝色是 blue，结尾是 ue。'],
    ['三餐词汇','早上吃的“早餐”用英语怎么拼？请填 b 开头的单词。','breakfast','早餐是 breakfast。写完可以对照 break 和 fast 两部分。']
  ])add('spelling',{type:'text',topic,prompt,key,explain});
  for(const [topic,prompt,options,correct,explain] of [
    ['复数主语与 be','My new classmates ___ in Class One.', ['is','are','am'],1,'classmates 指多名同学，搭配 are。完整句是 My new classmates are in Class One.'],
    ['have 与 has','Lily ___ two notebooks for English.', ['has','have','having'],0,'Lily 是一个人，陈述她“有”什么用 has：Lily has two notebooks for English.'],
    ['人称代词','Tom and I share a desk. ___ are in Class Seven.', ['He','They','We'],2,'Tom and I 包含说话的人，所以是“我们”We。We are in Class Seven.'],
    ['物主代词','This is Mei’s pencil case. ___ pencil case is blue.', ['She','Her','Hers'],1,'pencil case 前用 Her 表示“她的”。Hers 可以单独指“她的那个”，后面不再接这个名词。'],
    ['一般疑问句','___ your sister like art?', ['Does','Do','Is'],0,'like 是动作词，your sister 是第三人称单数，提问用 Does。Does your sister like art?'],
    ['存在句','There ___ two rulers in my pencil case.', ['am','is','are'],2,'two rulers 是复数，表示“有两把尺子”要用 There are two rulers.'],
    ['第三人称单数','My grandfather ___ tea every morning.', ['drinking','drink','drinks'],2,'每天发生的习惯用一般现在时，主语 grandfather 是单数，drink 变成 drinks。'],
    ['can 后的动词','Can your brother ___ the piano?', ['play','plays','playing'],0,'说能力时，can 后面接动词原形 play：Can your brother play the piano?']
  ])add('grammar',{type:'choice',topic,prompt,options,correct,explain});
  for(const [topic,passage,prompt,options,correct,explain] of [
    ['找开放时间','The library opens at nine. Mia gets there at eight and waits with her brother.','图书馆几点开门？',['八点','九点','十点'],1,'第一句 opens at nine 给出了开门时间。eight 是 Mia 到达的时间。'],
    ['区分两天的安排','We play basketball on Thursday. On Friday we draw pictures in the art room.','他们星期五做什么？',['打篮球','读故事','画画'],2,'第二句 On Friday we draw pictures 说星期五画画。篮球安排在星期四。'],
    ['按颜色找位置','Ben, your red notebook is on my desk. Your blue notebook is in your schoolbag. Love, Mum','Ben 的红色本子在哪里？',['在妈妈的书桌上','在 Ben 的书包里','在教室门口'],0,'按 red notebook 定位第一句。写便条的是 Mum，my desk 指妈妈的书桌。'],
    ['找代词所指','Leo has a little green box. He keeps his keys in it.','第二句的 it 指什么？',['Leo','绿色盒子','钥匙'],1,'前一句提到 a little green box，第二句 in it 就是“在盒子里”。'],
    ['根据条件判断','Fang goes to school by bus on rainy days. On sunny days she walks with May. It is raining today.','芳今天会怎样去学校？',['和 May 步行','骑自行车','乘公共汽车'],2,'先看今天的条件 It is raining，再找对应规则 by bus on rainy days。'],
    ['匹配两条线索','Lost: a blue bag with two yellow stars. Please take it to Room 3. Thank you!','哪件失物符合启事？',['有两颗黄色星星的蓝包','有一颗黄色星星的蓝包','有两颗蓝色星星的黄包'],0,'两条线索都要匹配：blue bag 指蓝包，two yellow stars 指两颗黄色星星。'],
    ['找集合地点','Our class will visit the museum on Saturday. Meet at the school gate at eight. We will take the bus together.','大家先在哪里集合？',['博物馆门口','校门口','公交车站'],1,'Meet at the school gate 直接说了集合点。museum 是之后要参观的目的地。'],
    ['读简单留言','Hi Sam! I have your football. Come to the park after lunch. We can play there. —Jo','Jo 希望 Sam 什么时候来公园？',['午饭前','上课时','午饭后'],2,'Come to the park after lunch 里的 after lunch 表示“午饭后”。']
  ])add('reading',{type:'choice',topic,passage,prompt,options,correct,explain});
  for(const [topic,prompt,options,order,explain] of [
    ['介绍名字','用 My 开头，拼出“我叫 Mei”。',['is','Mei.','My','name'],[2,3,0,1],'先写 My name（我的名字），再接 is 和名字：My name is Mei.'],
    ['指认复数物品','用 Those 开头，拼出“那些是我的书”。',['my','Those','books.','are'],[1,3,0,2],'Those 表示“那些”，搭配 are，最后放 my books：Those are my books.'],
    ['询问能力','用 Can 开头，拼出“他会游泳吗？”',['he','swim?','Can'],[2,0,1],'问能力时把 Can 放在主语 he 前面，后接动词原形：Can he swim?'],
    ['描述日常','用 We 开头，把“我们每天读英语”拼完整。',['every day.','English','read','We'],[3,2,1,0],'We read English 是完整的主干，把时间 every day 放在句末。'],
    ['说某处有物品','用 There 开头，表达“我的包里有两支笔”。',['two pens','in my bag.','There','are'],[2,3,0,1],'There are 后面接复数 two pens，再说明位置 in my bag。'],
    ['询问地点','用 Where 开头，拼出“图书馆在哪里？”',['the library?','Where','is'],[1,2,0],'提问地点用 Where is ...?：Where is the library?'],
    ['表达不喜欢','用 She 开头，拼出“她不喜欢牛奶”。',['like','She','milk.','does not'],[1,3,0,2],'第三人称单数的否定式是 does not + 动词原形：She does not like milk.'],
    ['询问颜色','用 What 开头，拼出“他的自行车是什么颜色？”',['is','his bike?','What','colour'],[2,3,0,1],'What colour 作为一个提问单位放在开头，再接 is his bike?']
  ])add('writing',{type:'order',topic,prompt,options,order,explain});

  const byId=new Map(bank.map(q=>[q.id,q]));
  const perSkill=Object.fromEntries(skillIds.map(s=>[s,bank.filter(q=>q.skill===s)]));
  const storeKey='happylearn.english.check.v1';
  const outcomeNames=['correct','wrong','skipped','unavailable'];
  const blank=()=>({serial:0,active:null,runs:{},log:[]});
  let state=blank(),lastRaw=null,canStore=true;
  const isSkill=k=>Object.hasOwn(skills,k);
  const isKey=k=>k==='diagnostic'||typeof k==='string'&&k.startsWith('practice:')&&isSkill(k.slice(9));
  const int=n=>Number.isSafeInteger(n)&&n>=0;
  function day(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function load(){
    if(!canStore)return;
    let raw;
    try{raw=localStorage.getItem(storeKey);}catch{canStore=false;return;}
    if(raw===lastRaw)return;
    lastRaw=raw;const data=blank();
    try{
      const old=JSON.parse(raw);
      if(old?.version===1){
        const receipts=new Set();
        for(const row of Array.isArray(old.log)?old.log:[]){
          if(!Array.isArray(row)||!int(row[0])||!byId.has(row[1])||!outcomeNames.includes(row[2])||!/^\d{4}-\d{2}-\d{2}$/.test(row[3]))continue;
          const key=row[0]+':'+row[1];if(receipts.has(key))continue;
          receipts.add(key);data.log.push(row.slice(0,4));data.serial=Math.max(data.serial,row[0]);
        }
        for(const [key,r] of Object.entries(old.runs||{})){
          if(!isKey(key)||!r||!int(r.serial)||!Array.isArray(r.ids)||!r.ids.every(id=>byId.has(id))||new Set(r.ids).size!==r.ids.length)continue;
          if(!int(r.index)||r.index>r.ids.length)continue;
          const valid=key==='diagnostic'?r.ids.length===5&&r.ids.every((id,i)=>byId.get(id).skill===skillIds[i]):
            r.ids.length===3&&r.ids.every(id=>byId.get(id).skill===key.slice(9));
          if(!valid)continue;
          const gap=r.ids.slice(0,r.index).findIndex(id=>!receipts.has(r.serial+':'+id));
          data.runs[key]={serial:r.serial,ids:r.ids,index:gap>=0?gap:r.index};data.serial=Math.max(data.serial,r.serial);
        }
        data.active=isKey(old.active)&&data.runs[old.active]?old.active:null;
        data.serial=Math.max(data.serial,int(old.serial)?old.serial:0);
      }
    }catch{/* Keep malformed check data separate from other learning saves. */}
    state=data;
  }
  function save(){
    if(!canStore)return;
    try{
      const raw=JSON.stringify({version:1,...state});localStorage.setItem(storeKey,raw);lastRaw=raw;
    }catch{canStore=false;}
  }
  function metrics(){
    const bySkill={},weakSkills=[];
    for(const skill of skillIds){
      const dates=new Map(),correctDates=new Set(),correctQuestions=new Set();
      let recentDates=new Set(),recentQuestions=new Set(),weak=false,lastDay=null;
      let correct=0,wrong=0,skipped=0,unavailable=0;
      for(const [,id,kind,date] of state.log){
        if(byId.get(id).skill!==skill)continue;
        if(kind==='unavailable'){unavailable++;continue;}
        lastDay=date;
        if(!dates.has(date))dates.set(date,{day:date,correct:0,wrong:0,skipped:0});
        dates.get(date)[kind]++;
        if(kind==='correct'){
          correct++;correctDates.add(date);correctQuestions.add(id);
          if(weak){
            recentDates.add(date);recentQuestions.add(id);
            if(recentDates.size>=2&&recentQuestions.size>=2)weak=false;
          }
        }else{
          if(kind==='wrong')wrong++;else skipped++;
          weak=true;recentDates=new Set();recentQuestions=new Set();
        }
      }
      const attempts=correct+wrong+skipped;
      const retained=!weak&&correctDates.size>=2&&correctQuestions.size>=2;
      bySkill[skill]={name:skills[skill],attempts,correct,wrong,skipped,unavailable,correctDays:correctDates.size,
        days:dates.size,lastDay,needsPractice:weak,retained,dates:[...dates.values()].sort((a,b)=>a.day.localeCompare(b.day)),
        status:!attempts?'unseen':weak?'needsPractice':retained?'recalled':'building'};
      if(weak)weakSkills.push(skill);
    }
    return {bySkill,weakSkills};
  }
  function stats(){load();return metrics();}
  function pick(skill,number){
    const reserved=new Set(Object.values(state.runs).flatMap(r=>r.ids));
    const use=new Map();
    state.log.forEach((row,index)=>use.set(row[1],index+1));
    return [...perSkill[skill]].sort((a,b)=>Number(reserved.has(a.id))-Number(reserved.has(b.id))||(use.get(a.id)||0)-(use.get(b.id)||0)).slice(0,number).map(q=>q.id);
  }
  function open(key){
    load();if(!isKey(key))return view();
    const old=state.runs[key];
    if(!old||old.index===old.ids.length){
      const ids=key==='diagnostic'?skillIds.flatMap(s=>pick(s,1)):pick(key.slice(9),3);
      state.runs[key]={serial:++state.serial,ids,index:0};
    }
    state.active=key;save();return view();
  }
  function orderedOptions(q,serial){
    if(!q.options)return [];
    const offset=(serial-1)%q.options.length;
    const options=[...q.options.slice(offset),...q.options.slice(0,offset)];
    if(q.type==='order'&&options.join(' ')===solution(q))options.push(options.shift());
    return options;
  }
  function solution(q){
    if(q.type==='order')return q.order.map(i=>q.options[i]).join(' ');
    if(q.type==='choice')return q.options[q.correct];
    return q.key;
  }
  function publicQuestion(q,serial){
    return {id:q.id,skill:q.skill,skillName:skills[q.skill],type:q.type,prompt:q.prompt,
      instruction:q.type==='order'?'依次选用所有词块，保留给定的标点。':q.type==='text'?'只填一个英语单词。':q.audioWord?'可以重播录音，再选一个中文意思。':'选出一个答案。',
      passage:q.passage||'',options:orderedOptions(q,serial),audioWord:q.audioWord||null};
  }
  function feedback(q,kind){
    const unavailable=kind==='unavailable';
    return {kind,correct:kind==='correct',answerText:unavailable?'':solution(q),
      explain:unavailable?'这道听辨没有计入表现，可以稍后再听。':q.explain};
  }
  function view(notice=null){
    const run=state.runs[state.active],list=run?state.log.filter(v=>v[0]===run.serial&&run.ids.includes(v[1])):[];
    const results=list.map(([,id,kind,date])=>({id,skill:byId.get(id).skill,kind,day:date}));
    const q=run?byId.get(run.ids[run.index]):null,receipt=q?list.find(row=>row[1]===q.id):null;
    const summary={total:run?.ids.length||0,assessed:0,correct:0,wrong:0,skipped:0,unavailable:0};
    for(const row of results){summary[row.kind]++;if(row.kind!=='unavailable')summary.assessed++;}
    return {phase:!run?'idle':!q?'complete':receipt?'feedback':'question',
      mode:!run?null:state.active==='diagnostic'?'diagnostic':'practice',
      skill:run&&state.active!=='diagnostic'?state.active.slice(9):null,
      position:run?Math.min(run.index+1,run.ids.length):0,total:summary.total,
      question:q?publicQuestion(q,run.serial):null,feedback:notice||(receipt?feedback(q,receipt[2]):null),
      results,summary,stats:metrics(),storageAvailable:canStore};
  }
  const normalize=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase():'';
  function grade(q,raw,options){
    if(q.type==='text'){
      const text=normalize(raw);return !text?null:text===normalize(solution(q));
    }
    if(q.type==='choice')return int(raw)&&raw<options.length?options[raw]===solution(q):null;
    if(!Array.isArray(raw)||raw.length!==options.length)return null;
    const chunks=raw.map(v=>int(v)?options[v]:v);
    if(new Set(chunks).size!==options.length||!chunks.every(v=>options.includes(v)))return null;
    return chunks.join(' ')===solution(q);
  }
  function accept(raw,skipReason){
    load();const run=state.runs[state.active],q=run&&byId.get(run.ids[run.index]);
    if(!q||state.log.some(row=>row[0]===run.serial&&row[1]===q.id))return view();
    let kind;
    if(skipReason==='audio-unavailable'){
      if(q.skill!=='listening')return view();
      kind='unavailable';
    }else if(skipReason==='skip')kind='skipped';
    else{
      const judged=grade(q,raw,orderedOptions(q,run.serial));
      if(judged===null)return view({kind:'empty',correct:false,answerText:'',explain:q.type==='order'?'请用完所有词块再核对。':'先输入或选择答案，也可以点“还不会”。'});
      kind=judged?'correct':'wrong';
    }
    state.log.push([run.serial,q.id,kind,day()]);save();
    if(kind!=='unavailable'){
      const example=q.passage||(q.skill==='listening'?q.audioWord:q.type==='order'?solution(q):q.prompt);
      window.LearnJournal?.record?.({source:'check',id:q.id,title:skills[q.skill]+' · '+q.topic,subject:'english',outcome:kind,
        note:'答案：'+solution(q)+'。'+q.explain,example});
    }
    return view();
  }
  function next(){
    load();const run=state.runs[state.active];
    if(run&&run.index<run.ids.length&&state.log.some(row=>row[0]===run.serial&&row[1]===run.ids[run.index])){
      run.index++;save();
    }
    return view();
  }
  window.EnglishCheck=Object.freeze({
    getState(){load();return view();},startDiagnostic:()=>open('diagnostic'),
    startPractice:skill=>isSkill(skill)?open('practice:'+skill):window.EnglishCheck.getState(),
    answer:raw=>accept(raw,null),skip:reason=>accept(null,reason==='audio-unavailable'?reason:'skip'),next,stats
  });
})();

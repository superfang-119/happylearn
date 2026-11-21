const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function setup() {
  const doc={activeElement:null,createElement:tag=>new Element(tag)};
  class Element {
    constructor(tag) {
      this.tag=tag;this.ownerDocument=doc;this.children=[];this.handlers={};this.textContent='';this.className='';
      this.classList={add:cls=>this.className+=' '+cls,toggle:(cls,yes)=>{if(yes)this.classList.add(cls);}};
    }
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    setAttribute(){}
    addEventListener(name,fn){this.handlers[name]=fn;}
    click(){this.handlers.click?.();}
    focus(){doc.activeElement=this;}
    find(cls){return [this,...this.children.flatMap(c=>c.find(''))].filter(e=>!cls||e.className.split(' ').includes(cls));}
  }
  const env={window:{}};
  for(const file of ['learn-facts.js','english-build.js'])
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),env);
  return {container:doc.createElement('div'),facts:env.window.LearnFacts,mount:env.window.EnglishBuild.mount};
}

test('all eighteen English models can be built by touch after opening, and other subjects have no extra exercise',()=>{
  const {container,facts,mount}=setup();
  for(const [id,fact] of Object.entries(facts).filter(([id])=>id.startsWith('en-'))) {
    mount(container,id);assert.equal(container.find('eb-launch').length,1);
    assert.equal(container.find('eb-chip').length,0);
    container.find('eb-launch')[0].click();
    const words=fact.model.en.split(' ');
    assert.ok(words.length>=3&&words.length<=6);
    assert.notDeepEqual(container.find('eb-chip').map(n=>n.textContent),words);
    assert.equal(container.find('eb-translation')[0].textContent,fact.model.zh);
    for(const word of words)container.find('eb-chip').find(chip=>chip.textContent===word).click();
    assert.equal(container.find('eb-complete')[0].textContent,fact.model.en);
    assert.equal(container.find('eb-message')[0].textContent,'拼好了！');
  }
  mount(container,'geo-direction');assert.equal(container.hidden,true);assert.equal(container.children.length,0);
});

test('wrong chips preserve the attempt, closing and reopening resumes, undo and replay leave the main route untouched',()=>{
  const {container,mount}=setup();
  mount(container,'en-name');container.find('eb-launch')[0].click();
  const get=word=>container.find('eb-chip').find(chip=>chip.textContent===word);
  get('Leo.').click();assert.match(container.find('eb-message')[0].textContent,/再试/);
  assert.equal(container.find('eb-chip').length,4);
  get('My').click();container.find('eb-hide')[0].click();container.find('eb-launch')[0].click();
  assert.equal(container.find('eb-line')[0].textContent,'My');
  container.find('eb-back')[0].click();assert.equal(container.find('eb-chip').length,4);
  for(const word of ['My','name','is','Leo.'])get(word).click();
  container.find('eb-back')[0].click();assert.equal(container.find('eb-chip').length,4);
});

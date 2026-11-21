const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '../dist');
const three = require(path.join(dist, 'vendor/three.min.js'));
const noop = () => {};

function createStreet(software) {
  let pending, clock = 0, snapshot, renderedColor;
  const listeners = new Map();
  const canvas = () => ({
    style:{}, getContext:() => ({}), setAttribute:noop, remove:noop,
    addEventListener:noop, removeEventListener:noop,
    getBoundingClientRect:() => ({width:720,height:480})
  });
  const window = {
    addEventListener:(type, fn) => listeners.set(type,fn),
    removeEventListener:type => listeners.delete(type),
    CityPerspective:{create:() => ({
      render(state){ renderedColor=state.carColor; return true; }, dispose:noop
    })},
    CityWorld:{build:noop,places:{}},
    THREE:{...three, WebGLRenderer:class {
      constructor(){ this.domElement=canvas(); } setPixelRatio(){} setSize(){} dispose(){}
      render(scene){
        scene.traverse(mesh => {
          if(mesh.material?.metalness===.23) {
            const color=mesh.material.color.getHexString();
            if(color==='f5398d') renderedColor='#'+color;
          }
        });
      }
    }}
  };
  const name=software?'city-map.js':'city-engine.js';
  vm.runInNewContext(fs.readFileSync(path.join(dist,name),'utf8'), {
    window, document:{createElement:canvas},
    requestAnimationFrame(fn){pending=fn;return 1;},cancelAnimationFrame(){pending=null;}
  });
  const create=software?window.CityMap.createFallback:window.CityEngine.create;
  const engine=create({append:noop,appendChild:noop,clientWidth:720,clientHeight:480},{onFrame:s=>{snapshot=s;}});
  return {engine, tick(count){
    for(let i=0;i<count;i++){clock+=1000/60;pending(clock);}
    return snapshot;
  }, key(code,down){ const type=down?'keydown':'keyup';listeners.get(type)({type,code,preventDefault:noop}); },
  color:()=>renderedColor};
}

for(const software of [false,true]) {
  test((software?'Canvas':'Three.js')+' applies running shoes to walking and sprinting and keeps vehicle acceleration unchanged', () => {
    const street=createStreet(software), engine=street.engine;
    engine.setInput('forward',true);
    function expectSpeed(expected){const frame=street.tick(65);assert.ok(Math.abs(frame.speed-expected)<.015,frame.speed+' vs '+expected);}
    expectSpeed(3.75*3.6);
    engine.setRunningShoes(true);expectSpeed(3.75*1.35*3.6);
    street.key('ShiftLeft',true);expectSpeed(6.2*1.35*3.6);
    engine.setRunningShoes(false);expectSpeed(6.2*3.6);
    street.key('ShiftLeft',false);engine.dispose();
    const drive=equipped=>{
      const s=createStreet(software),e=s.engine;
      e.setRunningShoes(equipped);e.setDrivingColor('#f5398d');s.tick(1);
      assert.ok(e.interactVehicle());e.setInput('forward',true);
      const frame=s.tick(80);
      assert.equal(s.color(),'#f5398d');e.dispose();return frame;
    };
    const standard=drive(false),sport=drive(true);
    assert.ok(standard.speed>20);
    assert.equal(sport.speed,standard.speed);assert.equal(sport.z,standard.z);
  });
}

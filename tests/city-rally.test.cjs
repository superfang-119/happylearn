const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('coastal trial requires driving, freezes the clock during menus and keeps the best lap', () => {
  const saved = new Map();
  const sandbox = {window:{},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/city-rally.js'),'utf8'),sandbox);
  const rally = sandbox.window.CityRally.create();
  function gate(driving,time) {
    const {x,z} = rally.markers()[0];
    return rally.tick({driving,x,z},time);
  }
  rally.start();
  assert.equal(gate(false,0),null);
  assert.equal(gate(true,50).type,'start');
  assert.equal(gate(true,1050).type,'checkpoint');
  rally.freeze();
  rally.tick({x:20,z:20,driving:true},60000);
  gate(true,61000); gate(true,62000);
  assert.equal(gate(true,63000).time,4000);
  assert.equal(sandbox.window.CityRally.create().snapshot().best,4000);
  rally.start();
  [0,2000,4000,6000].forEach(t => gate(true,t));
  assert.equal(gate(true,8000).fresh,false);
  assert.equal(rally.snapshot().best,4000);
});

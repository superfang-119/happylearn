/* Personal time trial. The clock advances only while the world is active. */
(() => {
  'use strict';
  const key = 'happylearn.sunset-harbor.trial.v1';
  const gates = [
    {x:0, z:-15, label:'起点 · 棕榈大道'},
    {x:0, z:-47, label:'北街路口'},
    {x:49, z:-48, label:'海岸东街'},
    {x:48, z:0, label:'滨海弯道'},
    {x:0, z:0, label:'终点 · 棕榈广场'}
  ];
  const format = ms => (Math.max(0, ms) / 1000).toFixed(1) + ' 秒';
  function create() {
    let active = false, index = 0, elapsed = 0, lastTick = null, record = null;
    try {
      const prior = JSON.parse(localStorage.getItem(key));
      if (prior && Number.isFinite(prior.time) && prior.time > 0 &&
          Array.isArray(prior.splits) && prior.splits.length === gates.length &&
          prior.splits.every(t => Number.isFinite(t) && t >= 0)) record = prior;
    } catch {}
    let splits = [];
    const start = () => { active = true; index = 0; elapsed = 0; splits = []; lastTick = null; };
    const stop = () => { active = false; lastTick = null; };
    const freeze = () => { lastTick = null; };
    const snapshot = () => ({active, index, elapsed, best:record?.time ?? null, total:gates.length});
    function tick(player, now) {
      if (!active) return null;
      if (index && lastTick !== null) elapsed += Math.max(0, now - lastTick);
      lastTick = now;
      const gate = gates[index];
      if (!player.driving || Math.hypot(gate.x - player.x, gate.z - player.z) > 6.5) return null;
      const gateTime = Math.round(elapsed);
      const delta = record ? gateTime - record.splits[index] : null;
      splits.push(gateTime);
      index++;
      if (index === gates.length) {
        const fresh = !record || gateTime < record.time;
        if (fresh) {
          record = {time:gateTime,splits:[...splits]};
          try { localStorage.setItem(key,JSON.stringify(record)); } catch {}
        }
        stop();
        return {type:'finish',time:gateTime,best:record.time,fresh,delta};
      }
      return {type:index === 1 ? 'start' : 'checkpoint',index,delta};
    }
    const markers = () => active ? [{...gates[index], id:'race-'+index, kind:'gate', color:'#ffbc50'}] : [];
    return {start,stop,freeze,tick,snapshot,markers};
  }
  window.CityRally = Object.freeze({create,format});
})();

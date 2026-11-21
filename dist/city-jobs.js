/* Local courier contracts, world markers and saved stops. No network required. */
(() => {
  'use strict';

  const storageKey = 'happylearn.city.courier.v1';
  const stop = (id, x, z, label, feedback = '') => ({ id, x, z, label, feedback });

  function checkpoint(kind, title, clue, options, destination, hint, receipt) {
    return { kind, title, clue, options, destination, hint, receipt };
  }

  function contact(x, z, name, instruction, greeting) {
    return checkpoint('contact', '找到' + name, instruction,
      [stop('contact', x, z, name)], 'contact', '驶入' + name + '身边的任务光圈。', greeting);
  }

  const contracts = [
    {
      id: 'city-english', subject: 'english', title: '蓝色邮袋', color: '#41c7e1',
      contactName: '邮差阿洛', livery: '晴空蓝',
      brief: '新邮差的第一单。取一只蓝邮袋，用英文路牌找到东边的接驳站。',
      memory: 'blue 是蓝色，east 是东，west 是西。读双语地址时，把颜色和方向都对上。',
      steps: [
        contact(6, -24, '邮差阿洛', '阿洛在中央大街北段等你。靠近邮袋标记，接下第一单。',
          '阿洛递来取件条：“Blue bag, please!” 蓝色是 blue。'),
        checkpoint('pickup', '领取蓝邮袋', '取件条写着 blue bag。去仓库门口，把蓝色包裹装上车。', [
          stop('red', -24, 0, 'RED · 红色货柜', 'red 是红色。对照取件条上的 blue，再看看另一个货柜。'),
          stop('blue', 24, 0, 'BLUE · 蓝色货柜')
        ], 'blue', '蓝色货柜在中央路口向东的路边。', '蓝邮袋已上车。地址写着 Blue East Stop：blue 蓝色，east 东方。'),
        checkpoint('delivery', '送到蓝色东驳站', '订单写着 Blue East Stop。东是 east，西是 west。把包裹送到方向和颜色都对的接驳站。', [
          stop('west', -48, -24, '蓝牌 · West Stop', '颜色对了，west 却是西。地址写的是 east。'),
          stop('east', 48, -24, '蓝牌 · East Stop'),
          stop('red', 48, 24, '红牌 · East Stop', 'east 对了，不过收件人说接驳站挂着蓝牌。')
        ], 'east', '向东看，到蓝牌的 East Stop 靠边。', '东驳站签收了蓝邮袋。你读懂了一份英文地址。')
      ]
    },
    {
      id: 'city-geography', subject: 'geography', title: '失灵的港口导航', color: '#69cc8a',
      contactName: '测绘员小岚', livery: '航线绿',
      brief: '导航失灵，用上北下南的港区图，连续驶过两座测绘门，拼回观测路线。',
      memory: '在上北下南的地图上，东在右、南在下。连续导航时，每过一站就把这里当成新的起点。',
      steps: [
        contact(72, -90, '测绘员小岚', '港区北路有辆测绘车。找到小岚，拿一张固定朝北的纸图。', '小岚铺开地图：“上北、下南、左西、右东。请从我这里往东走。”'),
        checkpoint('navigation', '穿过东方测绘门', '地图上方为北。从测绘员所在的路段向东行驶，穿过东面的浮标门。', [
          stop('west', 48, -90, '西浮标门', '从出发点到了左侧。看小地图，东在右。'),
          stop('east', 96, -90, '东浮标门')
        ], 'east', '东方测绘门在小岚的右侧，接近东岸大道。', '测到第一组数据。以这道门为新起点，下一道门在正南方。'),
        checkpoint('navigation', '接上南向航线', '从刚通过的门往正南。地图始终上北下南；车头转动时，地图中的南方仍在下方。', [
          stop('north', 96, -117, '北岸测绘门', '你沿同一条路向北了。掉头向地图下方找一找。'),
          stop('south', 96, -48, '南岸测绘门'),
          stop('west', 48, -90, '西岸测绘门', '这一路向西。回到东岸大道，沿同一条大道向南。')
        ], 'south', '留在东岸大道上，朝小地图下方前进。', '两段航线接起来了！你的路线是先东后南。')
      ]
    },
    {
      id: 'city-history', subject: 'history', title: '博物馆的时间货架', color: '#eda74f',
      contactName: '修复师禾叔', livery: '陶金橙',
      brief: '展柜标签被风吹乱了。驾驶文物车按年代装箱，把三段历史送回博物馆。',
      memory: '这条时间线从早到晚依次是河姆渡稻作、秦统一文字、西汉张骞出使西域。',
      steps: [
        contact(-90, 24, '修复师禾叔', '西城修复室的禾叔备好了空展柜，先去取货单。', '禾叔展开三格时间轴：史前河姆渡在前，再到秦，接着是西汉。'),
        checkpoint('collection', '装入最早的展品', '最早一格是史前河姆渡。那里留下稻作遗存，去模型货架取代表性的那一箱。', [
          stop('rice', -96, 48, '稻谷和干栏屋'),
          stop('seal', -72, 48, '小篆字模', '小篆与秦统一文字有关。它在河姆渡之后，再来取。'),
          stop('silk', -48, 72, '西域使者行囊', '行囊属于西汉使者，先找史前村落的模型。')
        ], 'rice', '稻谷和架高的木屋是河姆渡展箱的标志。', '第一格就位。下一格要复原秦统一文字。'),
        checkpoint('collection', '装上秦代字模', '秦统一后，以小篆为规范文字。到能向观众展示这种字形的货架装箱。', [
          stop('silk', -48, 72, '西域使者行囊', '这是西汉故事，时间线要先过秦。'),
          stop('seal', -72, 48, '小篆字模')
        ], 'seal', '写着“小篆字模”的木箱就在展区北路。', '第二格装好了。最后一格是西汉张骞出使西域。'),
        checkpoint('collection', '接上西汉使者', '最后一站要讲张骞出使西域。他是出行的使者，到能复原他旅途的货架装箱。', [
          stop('silk', -48, 72, '西域使者行囊'),
          stop('bone', -96, 72, '商代刻字龟甲', '商代甲骨远早于西汉。展单需要西域使者的行装。')
        ], 'silk', '寻找“西域使者行囊”，它在展区东路边。', '三箱展品都在车上，请去博物馆交展。'),
        checkpoint('delivery', '送回博物馆', '把按时间装好的三箱展品送进博物馆展厅。', [
          stop('museum', -96, 72, '城市博物馆')
        ], 'museum', '博物馆在西城大道南段。', '展柜开灯：河姆渡稻谷、秦的小篆字模、西汉使者行囊依次展出。')
      ]
    },
    {
      id: 'city-chinese', subject: 'chinese', title: '给海风录首诗', color: '#c999f6',
      contactName: '电台编辑阿禾', livery: '暮云紫',
      brief: '开着采风车，为城市电台收两段素材：让人听得见海边，也让寻常景物有人的神态。',
      memory: '“叮当”能唤起听觉；把人的动作赋予景物可以构成拟人。一首小诗可以同时用到这两种写法。',
      steps: [
        contact(24, 54, '电台编辑阿禾', '南街电台的编辑在门口等你。开近工作台，领取录音笔。', '阿禾按下录音键：“先给我一段闭上眼也能听出来的风景。”'),
        checkpoint('recording', '采集一段听觉素材', '录音笔需要听觉描写。到能录下清脆“叮当”声的采样点，停靠录音。', [
          stop('bells', 48, 72, '风铃长廊'),
          stop('paint', 0, 72, '蓝色壁画', '壁画的颜色靠眼睛看。试着寻找能发出声音的东西。'),
          stop('flowers', 24, 96, '桂花香径', '桂花香靠鼻子闻。编辑这次要一段声音。')
        ], 'bells', '南街东段的长廊挂满风铃。', '已录到“廊下风铃叮当”。下一段，编辑想让景物像人一样动起来。'),
        checkpoint('recording', '拍一帧拟人镜头', '两处取景台各标了一行诗。驶到让景物做出人的动作的那一幕，收下诗的第二行。', [
          stop('wave', 72, 96, '海风敲门，问我可回家'),
          stop('gold', 24, 96, '金色的光落在海面', '这句写出了颜色。再找找会“敲门”“问话”的海风。')
        ], 'wave', '“敲门”“问我”是人的动作。去标着这行诗的海边取景台。', '录音带合上了：“廊下风铃叮当。海风敲门，问我可回家。”')
      ]
    },
    {
      id: 'city-relay', subject: 'mixed', title: '环城星光接力', color: '#f4d670',
      contactName: '接力领航员', livery: '星光金',
      brief: '集齐四枚城市印记后，接过星光接力棒。沿途重用四科本领，开到海边灯塔。',
      memory: '',
      steps: [
        contact(0, -24, '接力领航员', '回中央大街领接力棒。夜跑按正确路线通关，随时可以停下来辨方向。', '第一棒的旗面是英文：West Market。去西市。'),
        checkpoint('relay', '西市交接', '从中央大街找 West Market。地图朝北，west 在左边，market 是市集。', [
          stop('east', 48, -72, 'East Market', 'east 在右边。旗面指定的是 west。'),
          stop('west', -48, -72, 'West Market')
        ], 'west', '西市位于中央大街左上方。', '西市盖章。接下来的信封要送去展示秦代规范文字的摊位。'),
        checkpoint('relay', '找到秦代印章', '比赛信封上印着“秦”。请从市集出发，在能展示秦代规范文字的摊位换棒。', [
          stop('seal', -48, 0, '小篆印摊'),
          stop('bone', -96, 0, '商代甲骨摊', '甲骨摊讲商代。秦统一文字时使用的规范字体是小篆。')
        ], 'seal', '展出小篆字模的摊位在市集南面的街角。', '小篆章盖好了。去找一行能让读者听到城市的诗。'),
        checkpoint('relay', '给接力带录个声', '选一行听觉描写。开到相应的路边读诗台，录一句送给终点的守塔人。', [
          stop('sand', 0, 48, '白沙映着金光', '白沙和金光是看见的景色。再找描写声音的诗句。'),
          stop('wave', 48, 48, '潮声一阵阵拍岸')
        ], 'wave', '听觉用到耳朵，找那句讲潮声的。', '录音已收。最后把接力带送到东南海角的灯塔。'),
        checkpoint('relay', '点亮海角灯塔', '东在右，南在下。到地图右下方的灯塔交棒，点亮沿途收集的四枚印记。', [
          stop('pier', 120, -96, '东北码头', '这是东北角的港口，终点在东南海角。'),
          stop('light', 96, 96, '东南灯塔')
        ], 'light', '沿东岸大道往地图下方行驶。', '灯塔点亮！四科接力完成，可以随时回来重跑。')
      ]
    }
  ];

  // Marker ids include the stage, so stray/stale proximity events cannot consume
  // a later stop. The public marker data never marks the destination by default.
  const byId = new Map(contracts.map(job => [job.id, job]));
  const markerId = (job, index, option) => job.id + ':' + index + ':' + option.id;
  const list = contracts.map(job => ({
    id: job.id, subject: job.subject, title: job.title, color: job.color, livery: job.livery,
    contactName: job.contactName, brief: job.brief, memory: job.memory,
    steps: job.steps.map((step, index) => {
      const goal = step.options.find(option => option.id === step.destination);
      return {
        kind: step.kind, title: step.title, clue: step.clue, x: goal.x, z: goal.z,
        options: step.options.map(option => ({
          id: markerId(job, index, option), label: option.label, x: option.x, z: option.z
        }))
      };
    })
  }));

  const clone = value => JSON.parse(JSON.stringify(value));
  const baseJobs = contracts.filter(job => job.subject !== 'mixed');
  const unlocked = (id, completed) => byId.has(id) &&
    (byId.get(id).subject !== 'mixed' || baseJobs.every(job => completed.includes(job.id)));

  function restore(input) {
    const source = input && typeof input === 'object' ? input : {};
    const rawCompleted = Array.isArray(source.completed) ? source.completed : [];
    const completed = [...new Set(rawCompleted.filter(id => byId.has(id) && unlocked(id, rawCompleted)))];
    const saved = { completed, checkpoints: {}, active: null, lastCompleted: null };
    for (const job of contracts) {
      const cp = source.checkpoints?.[job.id] ?? (source.active?.id === job.id ? source.active : null);
      if (!unlocked(job.id, completed) || !cp || !Number.isInteger(cp.step) || cp.step < 0 || cp.step >= job.steps.length) continue;
      saved.checkpoints[job.id] = { step: cp.step, hinted: cp.hinted === true };
    }
    const activeId = typeof source.active === 'string' ? source.active : source.active?.id;
    if (saved.checkpoints[activeId] && byId.has(activeId)) saved.active = activeId;
    if (saved.completed.includes(source.lastCompleted)) saved.lastCompleted = source.lastCompleted;
    return saved;
  }

  function create(config = {}) {
    let storage;
    try {
      storage = Object.hasOwn(config, 'storage') ? config.storage : window.localStorage;
    } catch { storage = null; }
    let saved = restore({});
    try { saved = restore(JSON.parse(storage?.getItem(storageKey) || 'null')); } catch { /* Optional browser storage. */ }
    const seed = config.progress || (Object.hasOwn(config, 'completed') || Object.hasOwn(config, 'active') ? config : null);
    if (seed) saved = restore(seed);

    function persist() {
      try { storage?.setItem(storageKey, JSON.stringify(saved)); } catch { /* Keep playing in memory. */ }
    }
    function result(type, message, extra) { return { type, message, ...extra }; }
    function getState() {
      return clone({
        ...saved,
        active: saved.active ? { id: saved.active, ...saved.checkpoints[saved.active] } : null,
        memories: baseJobs.filter(job => saved.completed.includes(job.id)).map(job =>
          ({ id: job.id, subject: job.subject, title: job.title, memory: job.memory }))
      });
    }
    function current() {
      const job = byId.get(saved.active);
      if (!job) return null;
      const checkpoint = saved.checkpoints[job.id];
      const step = job.steps[checkpoint.step];
      return { id: job.id, title: job.title, subject: job.subject, contactName: job.contactName, color: job.color,
        step: checkpoint.step, total: job.steps.length, stepTitle: step.title, clue: step.clue, kind: step.kind };
    }
    const isUnlocked = id => unlocked(id, saved.completed);
    function start(id) {
      if (!byId.has(id)) return result('invalid', '手机里没有这份委托。');
      if (!isUnlocked(id)) return result('locked', '先完成四科委托，就能开启环城接力。');
      if (saved.active && saved.active !== id) return result('busy', '先暂停当前委托，已到达的站点会保留。');
      const resumed = !!saved.checkpoints[id];
      saved.active = id;
      if (!resumed) saved.checkpoints[id] = { step: 0, hinted: false };
      persist();
      return result(resumed ? 'resumed' : 'started', current().clue, { id });
    }
    function pause() {
      if (!saved.active) return result('inactive', '当前没有进行中的委托。');
      const id = saved.active;
      saved.active = null;
      persist();
      return result('paused', '站点已保存，下次可从这里继续。', { id });
    }
    function markers() {
      const job = byId.get(saved.active);
      if (!job) return [];
      const cp = saved.checkpoints[job.id], step = job.steps[cp.step];
      return step.options.map(option => ({
        id: markerId(job, cp.step, option), x: option.x, z: option.z, label: option.label,
        kind: step.kind, color: job.color, highlighted: cp.hinted && option.id === step.destination
      }));
    }
    function hint() {
      const job = byId.get(saved.active);
      if (!job) return result('inactive', '先在手机上接一份委托。');
      const cp = saved.checkpoints[job.id], step = job.steps[cp.step];
      cp.hinted = true;
      persist();
      const dest = step.options.find(option => option.id === step.destination);
      return result('hint', step.hint, { id: job.id, markerId: markerId(job, cp.step, dest) });
    }
    function arrive(id) {
      const job = byId.get(saved.active);
      if (!job) return result('inactive', '当前没有进行中的委托。');
      const cp = saved.checkpoints[job.id], step = job.steps[cp.step];
      const place = step.options.find(option => markerId(job, cp.step, option) === id);
      if (!place) return result('invalid', '这不是当前路线的站点。');
      if (place.id !== step.destination) return result('wrong', place.feedback, { id: job.id });
      if (cp.step + 1 < job.steps.length) {
        cp.step++;
        cp.hinted = false;
        persist();
        return result('progress', step.receipt, { id: job.id, step: cp.step });
      }
      const fresh = !saved.completed.includes(job.id);
      if (fresh) saved.completed.push(job.id);
      saved.lastCompleted = job.id;
      saved.active = null;
      delete saved.checkpoints[job.id];
      persist();
      return result('completed', step.receipt, { id: job.id, fresh, memory: job.memory, livery: job.livery });
    }
    return Object.freeze({ getState, current, isUnlocked, start, pause, markers, hint, arrive });
  }

  window.CityJobs = Object.freeze({ list, create });
})();

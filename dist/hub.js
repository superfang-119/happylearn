(() => {
  'use strict';
  const { subjects, missions } = window.LEARNING_CONTENT;
  const game = window.Game;
  const regionStyles = {
    english:   { image: 'forest',  accent: '#96e7ae', base: '#234c3a' },
    geography: { image: 'harbor',  accent: '#8ddff0', base: '#205465' },
    history:   { image: 'ruins',   accent: '#ffd188', base: '#6b5031' },
    chinese:   { image: 'academy', accent: '#dfb5ee', base: '#533e65' }
  };
  const $ = selector => document.querySelector(selector);
  const artSource = name => window.HappyLearnImages?.[name] || 'art/' + name + '.png';
  const byId = new Map(missions.map(mission => [mission.id, mission]));
  const help = $('#hub-dialog');
  const gameDialog = $('#game-dialog');
  // UI glyphs share a 12-pixel grid with the painted island sprites.
  const pixels = {
    compass: ['....####....','..##....##..','.#........#.','.#.....##.#.','#.....###..#','#....###...#','#...###....#','#..###.....#','.#.##.....#.','.#........#.','..##....##..','....####....'],
    book: ['............','#####..#####','#....##....#','#....##....#','#....##....#','#....##....#','#....##....#','#....##....#','#####..#####','.....##.....','............','............'],
    award: ['...######...','..#......#..','.#...##...#.','.#..####..#.','.#...##...#.','..#......#..','...######...','...##..##...','..##....##..','..#.#..#.#..','.##......##.','............'],
    map: ['.......#....','..##..###...','.#####.###..','#..#....####','#..#...#...#','#..#...#...#','#..#...#...#','#..#...#...#','####...#..##','..###..###..','....####....','............'],
    flag: ['.#..........','.#########..','.########...','.#######....','.########...','.#########..','.#..........','.#..........','.#..........','.#..........','####........','............'],
    play: ['............','..#.........','..###.......','..#####.....','..#######...','..#########.','..#########.','..#######...','..#####.....','..###.......','..#.........','............'],
    guide: ['...######...','..##....##..','.##......##.','.##..##..##.','.##.....###.','......###...','.....##.....','.....##.....','............','.....##.....','.....##.....','............'],
    crystal: ['.....##.....','....####....','...##.###...','..##..####..','.##...#####.','.##########.','..########..','...######...','....####....','.....##.....','............','............'],
    sound: ['............','......#..#..','.....##...#.','....###.#.#.','.######..#.#','.######..#.#','.######..#.#','.######..#.#','....###.#.#.','.....##...#.','......#..#..','............'],
    mute: ['............','......#.....','.....##.....','....###.....','.######.#..#','.######..##.','.######..##.','.######.#..#','....###.....','.....##.....','......#.....','............']
  };
  const masks = new Map();
  function icon(name, element) {
    if (!masks.has(name) && pixels[name]) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 12;
      const context = canvas.getContext('2d');
      if (!context) return;
      pixels[name].forEach((row, y) => [...row].forEach((value, x) => {
        if (value === '#') context.fillRect(x, y, 1, 1);
      }));
      masks.set(name, 'url(' + canvas.toDataURL() + ')');
    }
    element.style.backgroundColor = 'currentColor';
    element.style.mask = masks.get(name) + ' center / contain no-repeat';
    element.style.webkitMask = element.style.mask;
    element.style.imageRendering = 'pixelated';
    element.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('[data-icon]').forEach(el => icon(el.dataset.icon, el));
  function readSound() { try { return localStorage.getItem('happy-learn.sound') !== 'off'; } catch { return true; } }
  let sound = readSound();
  let audioContext;
  function updateSound() {
    const button = $('[data-do="sound"]');
    button.setAttribute('aria-pressed', String(sound));
    button.setAttribute('aria-label', sound ? '关闭游戏音效' : '开启游戏音效');
    button.title = button.getAttribute('aria-label');
    icon(sound ? 'sound' : 'mute', button.querySelector('i'));
  }
  function chime(celebrate = false) {
    if (!sound) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      audioContext ||= new Context();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      (celebrate ? [523, 659, 784] : [440]).forEach((hz, index) => {
        const from = now + index * .095, end = from + (celebrate ? .16 : .07);
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(hz, from);
        gain.gain.setValueAtTime(.0001, from);
        gain.gain.exponentialRampToValueAtTime(.055, from + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(from); oscillator.stop(end + .01);
      });
    } catch { /* Audio is optional on silent devices. */ }
  }
  updateSound();

  const cards = new Map();
  subjects.forEach(subject => {
    const style = regionStyles[subject.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'region';
    button.dataset.region = subject.id;
    button.style.setProperty('--accent', style.accent);
    button.style.setProperty('--back', style.base);
    // All HTML here is authored game content bundled with the application.
    button.innerHTML = `<span class="region-picture"><img src="${artSource(style.image)}" alt=""><span class="region-badge"><img class="region-icon" src="${artSource(subject.id)}" alt="">${subject.name}</span></span><span class="region-body"><strong class="region-name">${subject.region}</strong><span class="region-summary">${subject.summary}</span><span class="region-progress"><span class="region-track"><b></b></span><span class="region-total"></span></span></span>`;
    cards.set(subject.id, button);
    $('#regions').append(button);
  });
  function nextMission(state) {
    if (state.active && byId.has(state.active.id)) return byId.get(state.active.id);
    const remainingByRegion = subjects.map(subject => {
      const all = missions.filter(m => m.subject === subject.id);
      return { next: all.find(m => !state.completed.includes(m.id)), done: all.filter(m => state.completed.includes(m.id)).length };
    }).sort((a,b) => a.done - b.done);
    const mixed = missions.filter(m => m.subject === 'mixed');
    const nextMixed = mixed.find(m => !state.completed.includes(m.id));
    const finishedMixed = mixed.length - mixed.filter(m => !state.completed.includes(m.id)).length;
    if (nextMixed && remainingByRegion[0].done >= 1 + finishedMixed * 2) return nextMixed;
    return remainingByRegion.find(region => region.next)?.next || nextMixed;
  }
  let lastTotal = game.getState().completed.length;
  function refresh(state) {
    subjects.forEach(subject => {
      const all = missions.filter(m => m.subject === subject.id);
      const done = all.filter(m => state.completed.includes(m.id)).length;
      const card = cards.get(subject.id);
      card.querySelector('.region-total').textContent = done + ' / ' + all.length;
      card.querySelector('.region-track b').style.width = (100 * done / all.length) + '%';
      card.setAttribute('aria-label', subject.region + '，' + subject.name + '，已完成 ' + done + ' 个任务，共 ' + all.length + ' 个');
    });
    const total = state.completed.length;
    const level = state.level;
    $('#hub-coins').textContent = state.coins;
    $('#port-coins').textContent = state.coins;
    $('#port-level').textContent = 'Lv.' + level;
    $('#level').textContent = 'LV. ' + String(level).padStart(2, '0');
    $('#rank').textContent = level < 3 ? '见习探险家' : level < 6 ? '群岛探险家' : '群岛领航员';
    $('#fragment-count').textContent = total + ' / ' + missions.length;
    $('#overall-bar').style.width = (100 * total / missions.length) + '%';
    $('#start-label').textContent = total === missions.length ? '回忆探险' : (total || state.active) ? '继续冒险' : '开始冒险';
    if (total) {
      const next = nextMission(state);
      const region = next && subjects.find(s => s.id === next.subject);
      $('#guide-line').textContent = !next ? '所有碎片都点亮啦！去知识图鉴试试，你还记得多少？' : next.subject === 'mixed' ? '远征已经开启！带上四座岛学到的本领，一起出发吧。' : '下一站，' + region.region + '！一起去完成「' + next.title + '」吧。';
      $('#progress-copy').textContent = '已收集 ' + total + ' 枚碎片，成功回忆 ' + state.reviewed.length + ' 张知识卡。';
    }
    const due = state.dueReviews?.length || 0;
    const review = $('#due-link');
    review.hidden = due === 0;
    review.textContent = '复习 ' + due + ' 张';
    if (total > lastTotal) chime(true);
    lastTotal = total;
  }
  function embark() {
    const next = nextMission(game.getState());
    if (!next) return game.openJournal();
    return game.start(next.subject, next.id);
  }
  function selectNav(mode = 'home') {
    document.querySelectorAll('.nav-item').forEach(button => {
      const chosen = button.dataset.do === mode;
      button.classList.toggle('current', chosen);
      if (chosen) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  document.addEventListener('click', event => {
    const counter = event.target.closest('[data-harbor-open]');
    if (counter) return window.HarborShop.open(counter.dataset.harborOpen);
    const target = event.target.closest('[data-do],[data-region]');
    if (!target) return;
    const action = target.dataset.do;
    if (action !== 'sound') chime();
    if (target.dataset.region) return game.openRegion(target.dataset.region);
    switch (action) {
      case 'home': selectNav(); window.scrollTo({top:0}); break;
      case 'start': embark(); break;
      case 'guide': help.showModal(); break;
      case 'close-guide': help.close(); break;
      case 'guide-start': help.close(); $('[data-do="start"]').focus(); embark(); break;
      case 'journal': selectNav(action); game.openJournal(); break;
      case 'awards': selectNav(action); game.openAchievements(); break;
      case 'review-due': selectNav('journal'); game.openJournal('due'); break;
      case 'mixed': game.startMixed(); break;
      case 'sound':
        sound = !sound;
        try { localStorage.setItem('happy-learn.sound', sound ? 'on' : 'off'); } catch {}
        updateSound(); chime(); break;
    }
  });
  help.addEventListener('click', event => { if (event.target === help) help.close(); });
  gameDialog.addEventListener('close', () => selectNav());
  game.subscribe(refresh);
  refresh(game.getState());
})();

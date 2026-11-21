const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function openGame(storage = new Map(), clock = Date) {
  const handlers = new Map();
  const dialog = {
    classList: { add() {} }, setAttribute() {}, contains: () => false,
    querySelectorAll: () => [], querySelector: () => null,
    addEventListener: (name, handler) => handlers.set(name, handler),
    showModal() { this.open = true; },
    close() { this.open = false; handlers.get('close')(); },
  };
  const sandbox = {
    Date: clock,
    window: { addEventListener() {} }, document: { getElementById: () => dialog },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  };
  for (const filename of ['content.js', 'game.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist', filename), 'utf8'), sandbox);
  }
  const click = (act, value = '') => handlers.get('click')({ target: { closest: () => ({dataset: {act, value: String(value)}}) } });
  const solve = mission => {
    sandbox.window.Game.start(mission.subject, mission.id);
    mission.sites.forEach((_, i) => click('inspect', i));
    click('to-choice');
    click('answer', mission.answer);
  };
  return { ...sandbox.window.LEARNING_CONTENT, game: sandbox.window.Game, dialog, click, solve };
}

module.exports = { openGame };

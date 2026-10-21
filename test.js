// Self-check for the column detector: node test.js
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');

const sandbox = {
  location: { hostname: 'chat.test' },
  innerWidth: 1600,
  document: {
    querySelector: () => null,
    body: { querySelectorAll: () => [] },
    addEventListener() {},
  },
  chrome: {
    storage: { sync: { get: async () => ({}), set() {} } },
    runtime: { onMessage: { addListener() {} } },
  },
  getComputedStyle: () => ({ maxWidth: 'none' }),
  MutationObserver: class { observe() {} },
  setTimeout: () => 0,
  clearTimeout() {},
  addEventListener() {},
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(`${__dirname}/content.js`, 'utf8'), sandbox);

const { isColumn } = sandbox;
assert.equal(typeof isColumn, 'function', 'isColumn not reachable');

const box = (left, width, height = 800) => ({ left, right: left + width, width, height });
const main = box(0, 1600);

assert.equal(isColumn(768, box(400, 768), main, 1600), true, 'centered 768px column widens');
assert.equal(isColumn(768, box(0, 1600), main, 1600), false, 'uncapped full-width box untouched');
assert.equal(isColumn(768, box(400, 768, 32), main, 1600), false, 'short chip untouched');
assert.equal(isColumn(768, box(0, 768), main, 1600), false, 'left-aligned box untouched');
assert.equal(isColumn(1600, box(0, 1600), main, 1600), false, 'cap wider than viewport ignored');
// offset turn inside an already-widened column: gutter shifts it off-center
assert.equal(isColumn(760, box(56, 760), main, 1600, false), true, 'gutter-offset turn inside a column');

console.log('ok — column detector, 6 cases');

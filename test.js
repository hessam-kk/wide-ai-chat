// Self-check for the column detector: node test.js
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');

const sandbox = {
  location: { hostname: 'chat.test' },
  innerWidth: 1600,
  document: {
    querySelector: () => null,
    body: {
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, right: 0, width: 0, height: 0 }),
      parentElement: null,
    },
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

const { isColumn, isPaddedBand } = sandbox;
assert.equal(typeof isColumn, 'function', 'isColumn not reachable');
assert.equal(typeof isPaddedBand, 'function', 'isPaddedBand not reachable');

const box = (left, width, height = 800) => ({ left, right: left + width, width, height });
const main = box(0, 1600);

assert.equal(isColumn(768, box(400, 768), main, 1600), true, 'centered 768px column widens');
assert.equal(isColumn(768, box(0, 1600), main, 1600), false, 'uncapped full-width box untouched');
assert.equal(isColumn(768, box(400, 768, 32), main, 1600), false, 'short chip untouched');
assert.equal(isColumn(768, box(0, 768), main, 1600), false, 'left-aligned box untouched');
assert.equal(isColumn(1600, box(0, 1600), main, 1600), false, 'cap wider than viewport ignored');
// offset turn inside an already-widened column: gutter shifts it off-center
assert.equal(isColumn(760, box(56, 760), main, 1600, false), true, 'gutter-offset turn inside a column');

// DeepSeek: 1400px band, 300px symmetric padding, 800px of text, no max-width
const band = { left: 0, right: 1400, width: 1400, height: 1925 };
assert.equal(isPaddedBand(300, 300, band, 1600), true, 'symmetrically padded band is a column');
assert.equal(isPaddedBand(16, 16, band, 1600), false, 'normal padding left alone');
assert.equal(isPaddedBand(300, 0, band, 1600), false, 'one-sided padding is not centring');

console.log('ok — detector, 9 cases');

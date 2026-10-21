// Self-check for the detector and for reset: node test.js
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');

const box = {}; // the message listener the content script registers
const sandbox = {
  location: { hostname: 'chat.test' },
  innerWidth: 1600,
  CSSStyleSheet: class {
    constructor() {
      this.css = '';
    }
    replaceSync(css) {
      this.css = css;
    }
  },
  document: {
    adoptedStyleSheets: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, right: 0, width: 0, height: 0 }),
      parentElement: null,
    },
    addEventListener() {},
  },
  chrome: {
    storage: { sync: { get: async () => ({}), set() {} } },
    runtime: { onMessage: { addListener: (f) => (box.listener = f) } },
  },
  getComputedStyle: () => ({ maxWidth: 'none' }),
  MutationObserver: class {
    observe() {}
  },
  setTimeout: () => 0,
  clearTimeout() {},
  addEventListener() {},
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(`${__dirname}/content.js`, 'utf8'), sandbox);

const { isColumn, isPaddedBand } = sandbox;
assert.equal(typeof isColumn, 'function', 'isColumn not reachable');
assert.equal(typeof isPaddedBand, 'function', 'isPaddedBand not reachable');

const rect = (left, width, height = 800) => ({ left, right: left + width, width, height });
const main = rect(0, 1600);

assert.equal(isColumn(768, rect(400, 768), main, 1600), true, 'centered 768px column widens');
assert.equal(isColumn(768, rect(0, 1600), main, 1600), false, 'uncapped full-width box untouched');
assert.equal(isColumn(768, rect(400, 768, 32), main, 1600), false, 'short chip untouched');
assert.equal(isColumn(768, rect(0, 768), main, 1600), false, 'left-aligned box untouched');
assert.equal(isColumn(1600, rect(0, 1600), main, 1600), false, 'cap wider than viewport ignored');
// offset turn inside an already-widened column: gutter shifts it off-center
assert.equal(isColumn(760, rect(56, 760), main, 1600, false), true, 'gutter-offset turn inside a column');

// DeepSeek: 1400px band, 300px symmetric padding, 800px of text, no max-width
const band = { left: 0, right: 1400, width: 1400, height: 1925 };
assert.equal(isPaddedBand(300, 300, band, 1600), true, 'symmetrically padded band is a column');
assert.equal(isPaddedBand(16, 16, band, 1600), false, 'normal padding left alone');
assert.equal(isPaddedBand(300, 0, band, 1600), false, 'one-sided padding is not centring');

// Overrides ride in one stylesheet, so reset has nothing of the site's to undo.
const sheets = () => sandbox.document.adoptedStyleSheets;
sandbox.paint();
assert.equal(sheets().length, 1, 'stylesheet installed');
assert.match(sheets()[0].css, /^\[data-wc~="w"\]\{max-width:90vw!important\}/, 'rule follows the slider');
sandbox.paint();
assert.equal(sheets().length, 1, 'paint is idempotent');

const el = { dataset: {} };
sandbox.mark(el, 'pad');
sandbox.mark(el, 'w');
sandbox.mark(el, 'w');
assert.equal(el.dataset.wc, 'pad w', 'tokens accumulate once');

let reply;
box.listener({ type: 'reset' }, null, (r) => (reply = r));
assert.equal(reply.pct, 0, 'reset reports off');
assert.equal(sheets().length, 0, 'reset removes the stylesheet');
sandbox.paint();
assert.equal(sheets().length, 0, 'stays off until the slider moves');

console.log('ok - detector + reset, 18 cases');
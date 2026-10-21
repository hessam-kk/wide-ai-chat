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

// Nothing applies until a site is ticked on; the sheet is the only override.
const sheets = () => sandbox.document.adoptedStyleSheets;
const ask = (msg) => {
  let reply;
  box.listener(msg, null, (r) => (reply = r));
  return reply;
};

assert.equal(ask({ type: 'get' }).pct, 0, 'a site starts off');
assert.equal(sheets().length, 0, 'no stylesheet before opt-in');
assert.equal(ask({ type: 'set', pct: '75' }).pct, 75, 'ticking on stores the width');
assert.equal(sheets().length, 1, 'stylesheet installed');
assert.match(sheets()[0].css, /^\[data-wc~="w"\]\{max-width:75vw!important\}/, 'rule follows the slider');
assert.equal(ask({ type: 'set', pct: '80' }).pct, 80, 'slider updates');
assert.equal(sheets().length, 1, 'set reuses the sheet');
assert.match(sheets()[0].css, /max-width:80vw/, 'one rule rewritten, no per-element work');

const el = { dataset: {} };
sandbox.mark(el, 'pad');
sandbox.mark(el, 'w');
sandbox.mark(el, 'w');
assert.equal(el.dataset.wc, 'pad w', 'tokens accumulate once');

assert.equal(ask({ type: 'reset' }).pct, 0, 'unticking reports off');
assert.equal(sheets().length, 0, 'unticking removes the stylesheet');
sandbox.paint();
assert.equal(sheets().length, 0, 'stays off until the site is ticked on');

console.log('ok - detector + opt-in + reset, 23 cases');
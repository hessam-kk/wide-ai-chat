// Wide Chat — lifts the max-width cap on chat columns. No per-site selectors:
// sites rename their classes constantly, so columns are found by geometry.
const host = location.hostname;
const SEL = 'div, section, article, ul, ol, p, pre';
let pct = 90; // 0 = off (stock layout)
let widths = {};
const touched = new Set();

// A column is a box whose own max-width cap is what binds its width, and
// (unless `centered` is off) sits centered inside its parent.
function isColumn(mw, r, parent, vw, centered = true) {
  if (!(mw >= 320) || mw >= vw * 0.98) return false;
  if (Math.abs(r.width - mw) > 60) return false; // cap not binding
  if (r.height < 40) return false; // chips, buttons
  if (!centered) return true;
  return !!parent && Math.abs((r.left + r.right) / 2 - (parent.left + parent.right) / 2) < 48;
}

function widen(el, cs, isCol) {
  el.style.setProperty('max-width', pct + 'vw', 'important');
  // fat horizontal padding is the other half of the gap on some layouts
  if (parseFloat(cs.paddingLeft) > 20) {
    el.style.setProperty('padding-left', '16px', 'important');
    el.style.setProperty('padding-right', '16px', 'important');
  }
  touched.add(el);
  if (isCol) el.dataset.wideCol = '1'; // marks a chat column for the loose pass below
}

function check(el) {
  if (!pct || touched.has(el)) return;
  // Inside a known column a cap is that turn's own gutter, and such turns are
  // offset from the column by an avatar gutter, so they are not centered.
  const inside = !!el.parentElement?.closest('[data-wide-col]');
  const p = el.parentElement;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const vw = innerWidth;
  if (isColumn(parseFloat(cs.maxWidth), r, p && p.getBoundingClientRect(), vw, !inside)) {
    widen(el, cs, !inside);
  } else if (inside) {
    // A fixed px width caps just as hard, it just lives in `width`, not `max-width`.
    const w = parseFloat(cs.width);
    if (!(w >= 320 && w < vw * 0.98) || Math.abs(r.width - w) > 60) return;
    el.style.setProperty('width', 'auto', 'important');
    widen(el, cs, false);
  }
}

function scan() {
  const root = document.querySelector('main') || document.body;
  if (!root || !pct) return;
  for (const el of touched) if (!el.isConnected) touched.delete(el);
  for (const el of root.querySelectorAll(SEL)) check(el);
}

// New markup (streamed turns, re-mounted messages, SPA nav) is checked on arrival.
let batch = new Set();
let timer = 0;
function flush() {
  timer = 0;
  const nodes = [...batch];
  batch = new Set();
  for (const n of nodes) {
    if (!n.isConnected) continue;
    check(n);
    for (const el of n.querySelectorAll(SEL)) check(el);
  }
}
function queue(nodes) {
  for (const n of nodes) batch.add(n);
  if (!timer) timer = setTimeout(flush, 300);
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'get') {
    scan();
    reply({ host, pct });
  } else if (msg.type === 'set') {
    pct = widths[host] = Math.min(100, Math.max(60, +msg.pct || 90));
    for (const el of touched) el.style.setProperty('max-width', pct + 'vw', 'important');
    scan();
    persist();
    reply({ pct });
  } else if (msg.type === 'reset') {
    for (const el of touched) {
      el.style.removeProperty('max-width');
      el.style.removeProperty('width');
      el.style.removeProperty('padding-left');
      el.style.removeProperty('padding-right');
      el.removeAttribute('data-wide-col');
    }
    touched.clear();
    widths[host] = pct = 0; // keep the off state so rescans stay quiet
    persist();
    reply({ pct });
  }
});

let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set({ widths }), 400);
};

(async () => {
  ({ widths = {} } = await chrome.storage.sync.get('widths'));
  pct = widths[host] ?? 90;
  scan();
  setTimeout(scan, 900); // SPAs mount the thread late
  setTimeout(scan, 3000);
  new MutationObserver((muts) => {
    const nodes = [];
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) nodes.push(n);
    if (nodes.length) queue(nodes);
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', () => queue([document.body]));
})();

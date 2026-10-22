// Wide AI Chat — lifts the max-width cap on chat columns. No per-site selectors:
// sites rename their classes constantly, so columns are found by geometry.
const host = location.hostname;
const SEL = 'div, section, article, ul, ol, p, pre';
let pct = 0; // 0 = off: a site does nothing until it is ticked on in the popup
let widths = {};
const touched = new Set(); // already handled: skip on rescan

// A column is a box whose own max-width cap is what binds its width, and
// (unless `centered` is off) sits centered inside its parent.
function isColumn(mw, r, parent, vw, centered = true) {
  if (!(mw >= 320) || mw >= vw * 0.98) return false;
  if (Math.abs(r.width - mw) > 60) return false; // cap not binding
  if (r.height < 40) return false; // chips, buttons
  if (!centered) return true;
  return !!parent && Math.abs((r.left + r.right) / 2 - (parent.left + parent.right) / 2) < 48;
}

// Centred by equal padding on both sides rather than a cap — DeepSeek pads with
// calc((100% - var(--message-list-max-width)) / 2) and sets no max-width at all.
function isPaddedBand(pad, padR, r, vw) {
  return pad > 40 && Math.abs(pad - padR) < 8 && r.width - pad - padR < vw * 0.9 && r.height > 200;
}

// Overrides live in one constructed stylesheet keyed by a data attribute, never
// in element inline styles: sites rewrite their own inline padding from JS
// (DeepSeek does, on every re-render), so a snapshot of it goes stale and reset
// would restore the wrong thing. A sheet we can drop always leaves stock layout.
function mark(el, token) {
  const now = el.dataset.wc || '';
  if (!now.split(' ').includes(token)) el.dataset.wc = now ? `${now} ${token}` : token;
}

let sheet = null;
function paint() {
  if (!pct) {
    if (!sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    sheet = null;
    return;
  }
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  sheet.replaceSync(
    `[data-wc~="w"]{max-width:${pct}vw!important}` +
      `[data-wc~="pad"]{padding-inline:16px!important}` +
      `[data-wc~="auto"]{width:auto!important}`,
  );
}

function trim(el) {
  mark(el, 'pad');
}

function widen(el, cs, isCol) {
  mark(el, 'w');
  // fat horizontal padding is the other half of the gap on some layouts
  if (parseFloat(cs.paddingLeft) > 20) trim(el);
  touched.add(el);
  if (isCol) mark(el, 'col'); // marks a chat column for the loose pass below
}

// Fallback anchor for threads that are not centred (DeepSeek aligns it left).
let widest = null;

function check(el) {
  if (!pct || touched.has(el)) return;
  // Inside a known column a cap is that turn's own gutter, and such turns are
  // offset from the column by an avatar gutter, so they are not centered.
  const inside = !!el.parentElement?.closest('[data-wc~="col"]');
  const p = el.parentElement;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const vw = innerWidth;
  const mw = parseFloat(cs.maxWidth);
  if (isColumn(mw, r, p && p.getBoundingClientRect(), vw, !inside)) return widen(el, cs, !inside);

  const pad = parseFloat(cs.paddingLeft);
  if (isPaddedBand(pad, parseFloat(cs.paddingRight), r, vw)) {
    trim(el);
    if (r.height > 300) mark(el, 'col'); // it is the content band: loosen below it
    return;
  }

  const binds = mw >= 320 && mw < vw * 0.98 && Math.abs(r.width - mw) <= 60;
  if (!inside) {
    if (binds && r.height > 300 && (!widest || r.width > widest.r.width)) widest = { el, cs, r };
    return;
  }
  // A fixed px width caps just as hard, it just lives in `width`, not `max-width`.
  const w = parseFloat(cs.width);
  if (w >= 320 && w < vw * 0.98 && Math.abs(r.width - w) <= 60) {
    mark(el, 'auto');
    widen(el, cs, false);
  }
}

function settle() {
  const root = document.body;
  if (!pct || !root || !widest || !widest.el.isConnected) return;
  if (!root.querySelector('[data-wc~="col"]')) widen(widest.el, widest.cs, true);
}

function scan() {
  const root = document.body;
  if (!root || !pct) return;
  for (const el of touched) if (!el.isConnected) touched.delete(el);
  widest = null;
  for (const el of root.querySelectorAll(SEL)) check(el);
  settle();
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
  settle();
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
    pct = widths[host] = Math.min(100, Math.max(30, +msg.pct || 90));
    paint();
    scan();
    persist();
    reply({ pct });
  } else if (msg.type === 'reset') {
    widths[host] = pct = 0;
    paint(); // drops the stylesheet: stock layout, nothing of the site's touched
    touched.clear();
    widest = null;
    for (const el of document.querySelectorAll('[data-wc]')) el.removeAttribute('data-wc');
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
  pct = widths[host] ?? 0; // opt-in: only sites you turned on are stored
  paint();
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

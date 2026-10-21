// Wide Chat — lifts the max-width cap on chat columns. No per-site selectors:
// sites rename their classes constantly, so columns are found by geometry.
const host = location.hostname;
let pct = 90; // 0 = off (stock layout)
let widths = {};
const touched = new Set();
let queued = false;

// A column is a box whose own max-width cap is what binds its width, and
// (unless `centered` is off) sits centered inside its parent.
function isColumn(mw, r, parent, vw, centered = true) {
  if (!(mw >= 320) || mw >= vw * 0.98) return false;
  if (Math.abs(r.width - mw) > 60) return false; // cap not binding
  if (r.height < 40) return false; // chips, buttons
  if (!centered) return true;
  return !!parent && Math.abs((r.left + r.right) / 2 - (parent.left + parent.right) / 2) < 48;
}

function widen(el, cs) {
  el.style.setProperty('max-width', pct + 'vw', 'important');
  // fat horizontal padding is the other half of the gap on some layouts
  if (parseFloat(cs.paddingLeft) > 20) {
    el.style.setProperty('padding-left', '16px', 'important');
    el.style.setProperty('padding-right', '16px', 'important');
  }
  touched.add(el);
}

function scan() {
  const root = document.querySelector('main') || document.body;
  if (!root || !pct) return;
  for (const el of touched) if (!el.isConnected) touched.delete(el);
  const vw = innerWidth;
  const cols = [];
  for (const el of root.querySelectorAll('div, section, article, ul, ol')) {
    if (touched.has(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const p = el.parentElement;
    if (isColumn(parseFloat(cs.maxWidth), r, p && p.getBoundingClientRect(), vw)) {
      widen(el, cs);
      cols.push(el);
    }
  }
  // Inside a known column, a remaining cap is that turn's own gutter (Gemini
  // caps per message and offsets it by an avatar gutter, so it is not centered).
  for (const col of cols) {
    for (const el of col.querySelectorAll('div, section, article, ul, ol, p, pre')) {
      if (touched.has(el)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!isColumn(parseFloat(cs.maxWidth), r, null, vw, false)) continue;
      widen(el, cs);
    }
  }
}

function rescan() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    scan();
  }, 800);
}

let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set({ widths }), 400);
};

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'get') {
    scan();
    reply({ host, pct });
  } else if (msg.type === 'set') {
    pct = widths[host] = Math.min(100, Math.max(60, +msg.pct || 90));
    for (const el of touched) el.style.setProperty('max-width', pct + 'vw', 'important');
    rescan();
    persist();
    reply({ pct });
  } else if (msg.type === 'reset') {
    for (const el of touched) {
      el.style.removeProperty('max-width');
      el.style.removeProperty('padding-left');
      el.style.removeProperty('padding-right');
    }
    touched.clear();
    widths[host] = pct = 0; // keep the off state so timed rescans stay quiet
    persist();
    reply({ pct });
  }
});

(async () => {
  ({ widths = {} } = await chrome.storage.sync.get('widths'));
  pct = widths[host] ?? 90;
  scan();
  setTimeout(scan, 900); // SPAs mount the thread late
  setTimeout(scan, 3000);
  new MutationObserver(rescan).observe(document.body, { childList: true }); // SPA nav only
  addEventListener('resize', rescan);
})();

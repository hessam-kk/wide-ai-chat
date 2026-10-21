// Debug dump — not used by the extension. Paste into the DevTools console on
// the site that refuses to widen (no element-picking needed), then send the table.
// Columns: what the detector reads, whether it would fire, and whether we
// already touched the box (`ours`).
(() => {
  const vw = innerWidth;
  const rows = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const cs = getComputedStyle(el);
    const mw = parseFloat(cs.maxWidth);
    const w = parseFloat(cs.width);
    const pad = parseFloat(cs.paddingLeft) || 0;
    const capped = mw >= 300 && mw < vw * 0.96;
    const fixed = cs.display !== 'inline' && w >= 300 && w < vw * 0.96 && Math.abs(r.width - w) <= 60;
    if (!capped && !fixed && pad < 40) continue;
    const p = el.parentElement?.getBoundingClientRect();
    const cls = typeof el.className === 'string' ? el.className.trim().slice(0, 40) : '';
    rows.push({
      el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? ' .' + cls.split(/\s+/).slice(0, 2).join('.') : ''),
      maxWidth: cs.maxWidth,
      width: cs.width,
      rectW: Math.round(r.width),
      h: Math.round(r.height),
      padL: cs.paddingLeft,
      offCenter: p ? Math.round((r.left + r.right) / 2 - (p.left + p.right) / 2) : null,
      capBinds: capped && Math.abs(r.width - mw) <= 60,
      ours: el.dataset.wideCol || el.style.maxWidth || '',
    });
  }
  rows.sort((a, b) => b.rectW - a.rectW);
  console.table(rows.slice(0, 80));
  copy(rows);
  return rows;
})();

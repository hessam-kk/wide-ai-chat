// Debug dump — not used by the extension, just paste it into DevTools.
//
// On the Gemini tab: DevTools (Ctrl+Shift+J) → Elements panel → click the
// paragraph of a message that stayed NARROW → back to Console → paste this.
// It prints what the extension's detector sees for that element and every
// ancestor, so we can tell which test rejects it. `copy()` leaves it on the
// clipboard if the table is too wide to screenshot.
(() => {
  const rows = [];
  for (let el = $0; el && el !== document.documentElement; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const mw = parseFloat(cs.maxWidth);
    const p = el.parentElement?.getBoundingClientRect();
    const name =
      el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '');
    rows.push({
      el: name,
      maxWidth: cs.maxWidth,
      width: cs.width,
      flexBasis: cs.flexBasis,
      rectW: Math.round(r.width),
      capBinds: Math.abs(r.width - mw) <= 60,
      h: Math.round(r.height),
      offCenterPx: p ? Math.round((r.left + r.right) / 2 - (p.left + p.right) / 2) : null,
      padL: cs.paddingLeft,
      ours: el.style.maxWidth || el.dataset.wideCol || '',
    });
  }
  console.table(rows);
  copy(rows);
  return rows;
})();

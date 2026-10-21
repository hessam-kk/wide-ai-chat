const range = document.getElementById('range');
const onBox = document.getElementById('on');
const pctEl = document.getElementById('pct');
const col = document.getElementById('col');
const hostEl = document.getElementById('host');
const note = document.getElementById('note');

let tab = null;

const send = (msg) => (tab ? chrome.tabs.sendMessage(tab.id, msg).catch(() => null) : Promise.resolve(null));

// A stock chat column, as a share of the stage: what "off" looks like.
const STOCK = 42;

const paint = () => {
  const on = onBox.checked;
  const pct = +range.value;
  range.disabled = !on;
  document.body.classList.toggle('off', !on);
  pctEl.textContent = on ? pct + '%' : 'off';
  pctEl.classList.toggle('off', !on);
  col.style.width = (on ? pct : STOCK) + '%';
  range.style.setProperty('--fill', (((pct - 30) / 70) * 100).toFixed(1) + '%');
  note.textContent = on ? 'Saved for this site' : 'Stock layout';
};

// Ticking the site on is the opt-in, and the only way anything is ever applied.
// Unticking is a full reset for that host: stock layout, no page reload.
onBox.onchange = async () => {
  const r = await send(onBox.checked ? { type: 'set', pct: +range.value } : { type: 'reset' });
  if (!r) {
    onBox.checked = !onBox.checked;
    return paint();
  }
  paint();
};

range.oninput = () => {
  paint();
  send({ type: 'set', pct: +range.value });
};

paint();

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await send({ type: 'get' });
  if (!r) {
    hostEl.textContent = 'Not available here';
    note.textContent = 'Open a chat site, then click the icon again.';
    range.disabled = onBox.disabled = true;
    return;
  }
  hostEl.textContent = r.host;
  onBox.checked = !!r.pct;
  if (r.pct) range.value = r.pct;
  paint();
})();
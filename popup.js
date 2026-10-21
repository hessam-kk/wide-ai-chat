const range = document.getElementById('range');
const onBox = document.getElementById('on');
const pctEl = document.getElementById('pct');
const hostEl = document.getElementById('host');
const note = document.getElementById('note');

let tab = null;

const send = (msg) => (tab ? chrome.tabs.sendMessage(tab.id, msg).catch(() => null) : Promise.resolve(null));

const paint = () => {
  range.disabled = !onBox.checked; // the tick is the only way in
  pctEl.textContent = onBox.checked ? range.value + '%' : 'off';
  note.textContent = onBox.checked ? 'Applies live - per site' : 'Off - tick to enable here';
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
    hostEl.textContent = 'Not available on this page';
    note.textContent = 'Open a chat site, then click the icon again.';
    range.disabled = onBox.disabled = true;
    return;
  }
  hostEl.textContent = r.host;
  onBox.checked = !!r.pct;
  if (r.pct) range.value = r.pct;
  paint();
})();
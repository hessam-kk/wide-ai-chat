const range = document.getElementById('range');
const pctEl = document.getElementById('pct');
const hostEl = document.getElementById('host');
const note = document.getElementById('note');
const resetBtn = document.getElementById('reset');

let tab = null;
let off = false;

const send = (msg) => (tab ? chrome.tabs.sendMessage(tab.id, msg).catch(() => null) : Promise.resolve(null));

const paint = () => {
  pctEl.textContent = off ? 'off' : range.value + '%';
  note.textContent = off ? 'Stock layout · drag to enable' : 'Per site · applies live';
};

range.oninput = () => {
  off = false;
  paint();
  send({ type: 'set', pct: +range.value });
};

resetBtn.onclick = async () => {
  if (!(await send({ type: 'reset' }))) return;
  off = true;
  paint();
};

paint();

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await send({ type: 'get' });
  if (!r) {
    hostEl.textContent = 'Not available on this page';
    note.textContent = 'Open a chat site, then click the icon again.';
    range.disabled = resetBtn.disabled = true;
    return;
  }
  hostEl.textContent = r.host;
  off = !r.pct;
  if (r.pct) range.value = r.pct;
  paint();
})();

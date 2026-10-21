const range = document.getElementById('range');
const pctEl = document.getElementById('pct');
const hostEl = document.getElementById('host');
const note = document.getElementById('note');

const show = () => { pctEl.textContent = range.value + '%'; };
show();

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'get' });
    hostEl.textContent = r.host;
    range.value = r.pct;
    show();
    range.oninput = () => {
      show();
      chrome.tabs.sendMessage(tab.id, { type: 'set', pct: +range.value }).catch(() => {});
    };
  } catch {
    hostEl.textContent = 'Not available on this page';
    note.textContent = 'Open a chat site, then click the icon again.';
    range.disabled = true;
  }
})();

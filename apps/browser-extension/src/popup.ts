export {};

const STORAGE_KEY  = 'kairosis_endpoint';

const endpointInput = document.getElementById('endpoint') as HTMLInputElement;
const saveBtn       = document.getElementById('save') as HTMLButtonElement;
const statusEl      = document.getElementById('status') as HTMLParagraphElement;

chrome.storage.local.get(STORAGE_KEY, (result) => {
  const saved = result[STORAGE_KEY] as string | undefined;
  if (saved) endpointInput.value = saved;
});

saveBtn.addEventListener('click', () => {
  const value = endpointInput.value.trim();
  if (!value) {
    showStatus('Enter a device endpoint URL.', 'error');
    return;
  }
  try {
    new URL(value);
  } catch {
    showStatus('Invalid URL.', 'error');
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEY]: value }, () => {
    showStatus('Saved.', 'ok');
  });
});

function showStatus(msg: string, type: 'ok' | 'error') {
  statusEl.textContent = msg;
  statusEl.className   = type;
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 2000);
}

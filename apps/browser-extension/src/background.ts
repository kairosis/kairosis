export {};

const STORAGE_KEY = 'kairosis_endpoint';

async function getEndpoint(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as string) ?? null;
}

async function send(payload: Record<string, unknown>): Promise<void> {
  const endpoint = await getEndpoint();
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch {
    // Kairosis offline — silently ignore
  }
}

function isTrackable(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

// Page visited — fires when navigation completes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!isTrackable(tab.url)) return;

  send({
    type:           'page.visited',
    url:            tab.url,
    title:          tab.title ?? '',
    tabId,
    windowId:       tab.windowId,
    transitionType: changeInfo.url ? 'navigate' : 'reload',
  });
});

// Tab opened
chrome.tabs.onCreated.addListener((tab) => {
  send({
    type:     'tab.opened',
    tabId:    tab.id ?? 0,
    windowId: tab.windowId,
    url:      isTrackable(tab.url) ? tab.url : undefined,
    title:    tab.title,
  });
});

// Tab closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  send({
    type:     'tab.closed',
    tabId,
    windowId: removeInfo.windowId,
  });
});

// Tab activated (user switches to tab)
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (!isTrackable(tab.url)) return;

  send({
    type:     'tab.activated',
    tabId,
    windowId,
    url:      tab.url,
    title:    tab.title ?? '',
  });
});

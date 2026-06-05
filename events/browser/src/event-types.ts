export const BrowserEventType = {
  PAGE_VISITED:   'browser.page.visited',
  TAB_OPENED:     'browser.tab.opened',
  TAB_CLOSED:     'browser.tab.closed',
  TAB_ACTIVATED:  'browser.tab.activated',
} as const;

export type BrowserEventTypeValue = typeof BrowserEventType[keyof typeof BrowserEventType];

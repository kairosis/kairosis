export const DesktopEventType = {
  APP_ACTIVATED:   'desktop.app.activated',
  SCREEN_LOCKED:   'desktop.screen.locked',
  SCREEN_UNLOCKED: 'desktop.screen.unlocked',
  IDLE_STARTED:    'desktop.idle.started',
  IDLE_ENDED:      'desktop.idle.ended',
  BATTERY_CHANGED: 'desktop.battery.changed',
} as const;

export type DesktopEventTypeValue = typeof DesktopEventType[keyof typeof DesktopEventType];

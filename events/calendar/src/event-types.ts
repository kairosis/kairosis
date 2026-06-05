export const CalendarEventType = {
  EVENT_CREATED: 'calendar.event.created',
  EVENT_UPDATED: 'calendar.event.updated',
  EVENT_DELETED: 'calendar.event.deleted',
  EVENT_STARTED: 'calendar.event.started',
  EVENT_ENDED:   'calendar.event.ended',
} as const;

export type CalendarEventTypeValue = typeof CalendarEventType[keyof typeof CalendarEventType];

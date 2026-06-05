export const EmailEventType = {
  RECEIVED: 'email.received',
  SENT: 'email.sent',
  READ: 'email.read',
} as const;

export type EmailEventTypeValue = typeof EmailEventType[keyof typeof EmailEventType];

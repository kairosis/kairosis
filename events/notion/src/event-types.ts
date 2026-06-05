export const NotionEventType = {
  PAGE_CREATED: 'notion.page.created',
  PAGE_UPDATED: 'notion.page.updated',
  DATABASE_UPDATED: 'notion.database.updated',
} as const;

export type NotionEventTypeValue = typeof NotionEventType[keyof typeof NotionEventType];

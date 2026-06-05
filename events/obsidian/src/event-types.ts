export const ObsidianEventType = {
  NOTE_CREATED: 'obsidian.note.created',
  NOTE_MODIFIED: 'obsidian.note.modified',
  NOTE_DELETED: 'obsidian.note.deleted',
  LINK_CREATED: 'obsidian.link.created',
} as const;

export type ObsidianEventTypeValue = typeof ObsidianEventType[keyof typeof ObsidianEventType];

import { z } from 'zod';

export const BrowserTabEventPayload = z.object({
  tabId:    z.number().int(),
  windowId: z.number().int().optional(),
  url:      z.string().url().optional(),
  title:    z.string().optional(),
});

export type BrowserTabEvent = z.infer<typeof BrowserTabEventPayload>;

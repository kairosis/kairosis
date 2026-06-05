import { z } from 'zod';

export const BrowserPageVisitedPayload = z.object({
  url:            z.string().url(),
  title:          z.string(),
  tabId:          z.number().int(),
  windowId:       z.number().int().optional(),
  transitionType: z.string().optional(),
});

export type BrowserPageVisited = z.infer<typeof BrowserPageVisitedPayload>;

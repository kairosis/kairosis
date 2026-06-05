import { z } from 'zod';

export const SlackReactionAddedPayload = z.object({
  teamId:    z.string(),
  userId:    z.string(),
  reaction:  z.string(),
  itemType:  z.string(),
  channelId: z.string().optional(),
  itemTs:    z.string(),
});

export type SlackReactionAdded = z.infer<typeof SlackReactionAddedPayload>;

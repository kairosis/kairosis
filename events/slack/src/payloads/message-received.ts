import { z } from 'zod';

export const SlackMessageReceivedPayload = z.object({
  teamId:    z.string(),
  channelId: z.string(),
  userId:    z.string(),
  text:      z.string(),
  ts:        z.string(),
  threadTs:  z.string().optional(),
});

export type SlackMessageReceived = z.infer<typeof SlackMessageReceivedPayload>;

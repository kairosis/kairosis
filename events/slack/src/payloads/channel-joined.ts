import { z } from 'zod';

export const SlackChannelJoinedPayload = z.object({
  teamId:    z.string(),
  userId:    z.string(),
  channelId: z.string(),
});

export type SlackChannelJoined = z.infer<typeof SlackChannelJoinedPayload>;

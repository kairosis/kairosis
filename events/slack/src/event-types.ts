export const SlackEventType = {
  MESSAGE_RECEIVED: 'slack.message.received',
  REACTION_ADDED: 'slack.reaction.added',
  CHANNEL_JOINED: 'slack.channel.joined',
} as const;

export type SlackEventTypeValue = typeof SlackEventType[keyof typeof SlackEventType];

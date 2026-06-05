import { z } from 'zod';

export const ActorSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'bot', 'system', 'device']),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
});

export type Actor = z.infer<typeof ActorSchema>;

import { z } from 'zod';
import { ActorSchema } from './actor';
import { SubjectSchema } from './subject';

export const ClaimCheckSchema = z.object({
  objectKey:  z.string(),
  url:        z.string().url(),
  expiresAt:  z.string().datetime(),
});

export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

export const NormalizedEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  workspaceId: z.string().uuid(),
  connectorId: z.string().regex(/^[a-z0-9-]+$/),
  occurredAt: z.string().datetime(),
  ingestedAt: z.string().datetime(),
  actor: ActorSchema.optional(),
  subject: SubjectSchema.optional(),
  payload: z.record(z.unknown()),
  raw: z.unknown().optional(),
  version: z.string().default('1'),
  claimCheck: ClaimCheckSchema.optional(),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

import { z } from 'zod';

const AddressSchema = z.object({
  name:    z.string().optional(),
  address: z.string(),
});

export const EmailReceivedPayload = z.object({
  messageId: z.string(),
  uid:       z.number().int().positive(),
  mailbox:   z.string(),
  from:      AddressSchema,
  to:        z.array(AddressSchema).default([]),
  cc:        z.array(AddressSchema).default([]),
  subject:   z.string(),
  date:      z.string().datetime(),
  snippet:   z.string().optional(),
  body:      z.string().optional(),
  bodyHtml:  z.string().optional(),
});

export type EmailReceived = z.infer<typeof EmailReceivedPayload>;

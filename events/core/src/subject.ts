import { z } from 'zod';

export const SubjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string().optional(),
  url: z.string().url().optional(),
});

export type Subject = z.infer<typeof SubjectSchema>;

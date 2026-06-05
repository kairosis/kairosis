import { z } from 'zod';

export const GithubIssuePayload = z.object({
  repository:  z.string(),
  issueNumber: z.number().int().positive(),
  title:       z.string(),
  body:        z.string().nullable().optional(),
  authorName:  z.string(),
  state:       z.enum(['open', 'closed']),
  url:         z.string().url(),
  labels:      z.array(z.string()).default([]),
});

export type GithubIssue = z.infer<typeof GithubIssuePayload>;

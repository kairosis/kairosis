import { z } from 'zod';

export const GithubPrOpenedPayload = z.object({
  repository: z.string(),
  prNumber:   z.number().int().positive(),
  title:      z.string(),
  body:       z.string().optional(),
  authorName: z.string(),
  headBranch: z.string(),
  baseBranch: z.string(),
  url:        z.string().url(),
  draft:      z.boolean().default(false),
});

export type GithubPrOpened = z.infer<typeof GithubPrOpenedPayload>;

import { z } from 'zod';

export const GithubPrMergedPayload = z.object({
  repository:  z.string(),
  prNumber:    z.number().int().positive(),
  title:       z.string(),
  authorName:  z.string(),
  mergedBy:    z.string(),
  headBranch:  z.string(),
  baseBranch:  z.string(),
  url:         z.string().url(),
  mergeCommit: z.string().optional(),
});

export type GithubPrMerged = z.infer<typeof GithubPrMergedPayload>;

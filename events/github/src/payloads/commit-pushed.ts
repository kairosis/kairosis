import { z } from 'zod';

export const GithubCommitPushedPayload = z.object({
  repository: z.string(),
  branch:     z.string(),
  commitSha:  z.string(),
  message:    z.string(),
  authorName: z.string(),
  url:        z.string().url(),
  additions:  z.number().int().nonnegative().optional(),
  deletions:  z.number().int().nonnegative().optional(),
});

export type GithubCommitPushed = z.infer<typeof GithubCommitPushedPayload>;

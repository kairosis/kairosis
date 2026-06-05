import { z } from 'zod';

export const TerminalDirectoryChangedPayload = z.object({
  cwd:      z.string(),
  hostname: z.string().optional(),
  user:     z.string().optional(),
});

export type TerminalDirectoryChanged = z.infer<typeof TerminalDirectoryChangedPayload>;

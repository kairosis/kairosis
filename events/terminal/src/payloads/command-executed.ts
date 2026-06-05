import { z } from 'zod';

export const TerminalCommandExecutedPayload = z.object({
  command:  z.string(),
  exitCode: z.number().int().optional(),
  cwd:      z.string(),
  shell:    z.string().optional(),
  duration: z.number().nonnegative().optional(),
  hostname: z.string().optional(),
  user:     z.string().optional(),
});

export type TerminalCommandExecuted = z.infer<typeof TerminalCommandExecutedPayload>;

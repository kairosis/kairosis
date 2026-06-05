import { z } from 'zod';

export const ConnectorManifestSchema = z.object({
  id:           z.string().regex(/^[a-z0-9-]+$/),
  name:         z.string(),
  description:  z.string(),
  version:      z.string(),
  author:       z.string(),
  type:         z.enum(['webhook', 'poller', 'device', 'import', 'sync']),
  triggers:     z.array(z.string()),
  requiresAuth:       z.boolean().default(false),
  authType:           z.enum(['oauth2', 'apikey', 'basic', 'none']).default('none'),
  setupInstructions:  z.array(z.string()).default([]),
});

export type ConnectorManifest = z.infer<typeof ConnectorManifestSchema>;
export type ConnectorType = ConnectorManifest['type'];

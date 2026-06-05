import { z } from 'zod';

export const SpotifyTrackCompletedPayload = z.object({
  trackId:         z.string(),
  trackName:       z.string(),
  artist:          z.string(),
  durationMs:      z.number(),
  listenedPercent: z.number(),
});

export type SpotifyTrackCompleted = z.infer<typeof SpotifyTrackCompletedPayload>;

import { z } from 'zod';

export const SpotifyListeningSessionEndedPayload = z.object({
  durationMinutes: z.number(),
  trackCount:      z.number(),
  topGenres:       z.array(z.string()),
  skippedCount:    z.number(),
  startedAt:       z.string().datetime(),
  endedAt:         z.string().datetime(),
});

export type SpotifyListeningSessionEnded = z.infer<typeof SpotifyListeningSessionEndedPayload>;

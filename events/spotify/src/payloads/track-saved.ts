import { z } from 'zod';

export const SpotifyTrackSavedPayload = z.object({
  trackId:   z.string(),
  trackName: z.string(),
  artist:    z.string(),
  album:     z.string(),
  savedAt:   z.string().datetime(),
});

export type SpotifyTrackSaved = z.infer<typeof SpotifyTrackSavedPayload>;

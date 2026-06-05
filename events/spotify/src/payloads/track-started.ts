import { z } from 'zod';

export const SpotifyTrackStartedPayload = z.object({
  trackId:     z.string(),
  trackName:   z.string(),
  artist:      z.string(),
  artistId:    z.string(),
  album:       z.string(),
  albumId:     z.string(),
  durationMs:  z.number(),
  popularity:  z.number(),
  explicit:    z.boolean(),
  url:         z.string(),
  previewUrl:  z.string().nullable().optional(),
  genres:      z.array(z.string()),
  contextType: z.enum(['playlist', 'album', 'artist']).optional(),
  contextUri:  z.string().optional(),
});

export type SpotifyTrackStarted = z.infer<typeof SpotifyTrackStartedPayload>;

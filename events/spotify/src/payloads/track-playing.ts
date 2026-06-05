import { z } from 'zod';

const ArtistSchema = z.object({
  id:   z.string(),
  name: z.string(),
  url:  z.string().optional(),
});

const AlbumSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  imageUrl: z.string().optional(),
});

export const SpotifyTrackPlayingPayload = z.object({
  trackId:    z.string(),
  trackName:  z.string(),
  artists:    z.array(ArtistSchema),
  album:      AlbumSchema,
  durationMs: z.number(),
  progressMs: z.number(),
  isPlaying:  z.boolean(),
  url:        z.string(),
});

export type SpotifyTrackPlaying = z.infer<typeof SpotifyTrackPlayingPayload>;

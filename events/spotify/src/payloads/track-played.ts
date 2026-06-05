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

export const SpotifyTrackPlayedPayload = z.object({
  trackId:     z.string(),
  trackName:   z.string(),
  artists:     z.array(ArtistSchema),
  album:       AlbumSchema,
  durationMs:  z.number(),
  explicit:    z.boolean(),
  url:         z.string(),
  previewUrl:  z.string().nullable().optional(),
  playedAt:    z.string().datetime(),
  contextType: z.string().optional(),
  contextUrl:  z.string().optional(),
});

export type SpotifyTrackPlayed = z.infer<typeof SpotifyTrackPlayedPayload>;

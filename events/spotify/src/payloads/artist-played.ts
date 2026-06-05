import { z } from 'zod';

export const SpotifyArtistPlayedPayload = z.object({
  artistId:   z.string(),
  artistName: z.string(),
  genres:     z.array(z.string()),
  popularity: z.number(),
  url:        z.string().optional(),
});

export type SpotifyArtistPlayed = z.infer<typeof SpotifyArtistPlayedPayload>;

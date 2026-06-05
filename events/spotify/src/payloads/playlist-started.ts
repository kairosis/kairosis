import { z } from 'zod';

export const SpotifyPlaylistStartedPayload = z.object({
  playlistId:   z.string(),
  playlistName: z.string(),
  trackCount:   z.number(),
  owner:        z.string(),
  uri:          z.string(),
});

export type SpotifyPlaylistStarted = z.infer<typeof SpotifyPlaylistStartedPayload>;

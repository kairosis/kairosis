import { z } from 'zod';

export const SpotifyPodcastEpisodeStartedPayload = z.object({
  episodeId:    z.string(),
  episodeTitle: z.string(),
  showName:     z.string(),
  showId:       z.string(),
  durationMs:   z.number(),
  description:  z.string().optional(),
  url:          z.string().optional(),
});

export type SpotifyPodcastEpisodeStarted = z.infer<typeof SpotifyPodcastEpisodeStartedPayload>;

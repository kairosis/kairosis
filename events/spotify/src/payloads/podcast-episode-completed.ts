import { z } from 'zod';

export const SpotifyPodcastEpisodeCompletedPayload = z.object({
  episodeId:       z.string(),
  episodeTitle:    z.string(),
  showName:        z.string(),
  durationMs:      z.number(),
  listenedPercent: z.number(),
});

export type SpotifyPodcastEpisodeCompleted = z.infer<typeof SpotifyPodcastEpisodeCompletedPayload>;

export const SpotifyEventType = {
  TRACK_STARTED:             'spotify.track.started',
  TRACK_COMPLETED:           'spotify.track.completed',
  TRACK_SAVED:               'spotify.track.saved',
  PLAYLIST_STARTED:          'spotify.playlist.started',
  PODCAST_EPISODE_STARTED:   'spotify.podcast.episode.started',
  PODCAST_EPISODE_COMPLETED: 'spotify.podcast.episode.completed',
  ARTIST_PLAYED:             'spotify.artist.played',
  LISTENING_SESSION_ENDED:   'spotify.listening.session.ended',
} as const;

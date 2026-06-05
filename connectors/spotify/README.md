# Spotify Connector

Tracks your Spotify listening activity by polling the Spotify Web API.

**Type:** `poller` (runs every minute)  
**Auth:** OAuth 2.0 (via Kairosis OAuth flow)

## Events

| Routing key | Trigger |
|---|---|
| `spotify.track.started` | New track started playing |
| `spotify.track.completed` | Track listened to ≥ 90% |
| `spotify.track.saved` | Track added to Liked Songs |
| `spotify.playlist.started` | Playback context changed to a new playlist |
| `spotify.podcast.episode.started` | Podcast episode started |
| `spotify.podcast.episode.completed` | Podcast episode listened to ≥ 90% |
| `spotify.artist.played` | First time an artist is heard (persisted across restarts) |
| `spotify.listening.session.ended` | Playback idle for 5+ minutes — session summary emitted |

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `includeCurrentlyPlaying` | `boolean` | `true` | Poll currently-playing and emit track/episode events |
| `includeSavedTracks` | `boolean` | `true` | Poll Liked Songs every 5 minutes |
| `includeRecentlyPlayed` | `boolean` | `true` | Bootstrap cursor from recently-played on first run |

## Required OAuth scopes

| Scope | Used for |
|---|---|
| `user-read-currently-playing` | Track and episode detection |
| `user-read-playback-state` | Playback state and context |
| `user-read-recently-played` | Startup cursor bootstrap |
| `user-library-read` | Liked Songs polling |

## Setup

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create a new app.
2. Add `{API_PUBLIC_URL}/oauth2/callback/spotify` as a **Redirect URI** in the app settings.
3. Copy the **Client ID** into `SPOTIFY_CLIENT_ID` and the **Client Secret** into `SPOTIFY_CLIENT_SECRET` in your `.env`.
4. Save this instance, then click the **Authorize** button to connect your Spotify account.

## State machine

The connector persists the following state between polls (stored in the `state` JSONB column):

- **Track state** — last track ID and progress, used to detect track changes and completions
- **Episode state** — same for podcast episodes
- **Session state** — accumulated track list, session start time, idle timestamp
- **`heardArtistIds`** — persists across restarts so `spotify.artist.played` is emitted exactly once per artist
- **`savedTrackIds`** — bootstrapped silently on first run; new additions emit `spotify.track.saved`

## Listening session

A session starts when playback begins and ends after 5 minutes of idle (no active playback). The `spotify.listening.session.ended` payload includes:

```json
{
  "durationMinutes": 42,
  "trackCount": 12,
  "topGenres": ["hip-hop", "pop", "r&b"],
  "skippedCount": 2,
  "startedAt": "2026-06-05T20:00:00.000Z",
  "endedAt": "2026-06-05T20:47:00.000Z"
}
```

A track counts as skipped if less than 30% of it was listened to.

## Notes

- Spotify's `/audio-features` endpoint is deprecated for apps created after November 2024 — audio features are not included in any events.
- Genre data comes from the artist endpoint. Some artists have empty genre arrays — `genres: []` is normal.
- Artist and playlist data is cached in memory for the lifetime of the process to minimize API calls.
- The saved tracks list is capped at 500 IDs in state. Only the 50 most recently liked songs are fetched per poll.

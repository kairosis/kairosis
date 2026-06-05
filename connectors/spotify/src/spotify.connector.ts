import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OAuth2Provider } from '@kairosis/connector-sdk';
import { IPollerConnector, ConnectorManifest, PollResult } from '@kairosis/connectors';
import { NormalizedEvent } from '@kairosis/events-core';
import { SpotifyEventType } from '@kairosis/spotify-events';

const SPOTIFY_API              = 'https://api.spotify.com/v1';
const IDLE_TIMEOUT_MS          = 5 * 60_000;
const SAVED_TRACKS_INTERVAL_MS = 5 * 60_000;
const COMPLETION_THRESHOLD     = 0.9;
const SKIP_THRESHOLD           = 0.3;

// ─── Spotify API response types ───────────────────────────────────────────────

interface SpotifyArtistRef {
  id:            string;
  name:          string;
  external_urls: { spotify: string };
}

interface SpotifyTrack {
  id:            string;
  type:          'track';
  name:          string;
  artists:       SpotifyArtistRef[];
  album:         { id: string; name: string; images: Array<{ url: string }> };
  duration_ms:   number;
  explicit:      boolean;
  popularity:    number;
  external_urls: { spotify: string };
  preview_url:   string | null;
}

interface SpotifyEpisode {
  id:            string;
  type:          'episode';
  name:          string;
  description:   string;
  duration_ms:   number;
  external_urls: { spotify: string };
  show:          { id: string; name: string };
}

interface SpotifyContext {
  type:          'playlist' | 'album' | 'artist';
  uri:           string;
  external_urls: { spotify: string };
}

interface SpotifyCurrentlyPlaying {
  is_playing:             boolean;
  progress_ms:            number | null;
  item:                   SpotifyTrack | SpotifyEpisode | null;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  context:                SpotifyContext | null;
}

interface SpotifyFullArtist {
  id:            string;
  name:          string;
  genres:        string[];
  popularity:    number;
  external_urls: { spotify: string };
}

interface SpotifyRecentlyPlayedItem {
  track:     SpotifyTrack;
  played_at: string;
  context:   SpotifyContext | null;
}

interface SpotifyPlaylist {
  id:            string;
  name:          string;
  tracks:        { total: number };
  owner:         { display_name: string };
  external_urls: { spotify: string };
}

interface SpotifySavedTrackItem {
  added_at: string;
  track:    SpotifyTrack;
}

// ─── Minimal objects stored in persisted state ────────────────────────────────

interface StoredTrack {
  id:          string;
  name:        string;
  artistName:  string;
  artistId:    string;
  duration_ms: number;
  url:         string;
}

interface StoredEpisode {
  id:          string;
  name:        string;
  showName:    string;
  duration_ms: number;
  url:         string;
}

interface SessionTrackEntry {
  trackId:    string;
  trackName:  string;
  artist:     string;
  durationMs: number;
  listenedMs: number;
  genres:     string[];
}

// ─── Persisted state ──────────────────────────────────────────────────────────

interface SpotifyState {
  lastTrackId:             string | null;
  lastTrack:               StoredTrack | null;
  lastProgressMs:          number;
  lastEpisodeId:           string | null;
  lastEpisode:             StoredEpisode | null;
  lastContextUri:          string | null;
  sessionTracks:           SessionTrackEntry[];
  sessionStartedAt:        string | null;
  idleSince:               string | null;
  savedTrackIds:           string[];
  savedTracksBootstrapped: boolean;
  heardArtistIds:          string[];
  recentlyPlayedBootstrapped: boolean;
  lastSavedTracksAt:       number | null;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  includeCurrentlyPlaying: z.boolean().default(true),
  includeSavedTracks:      z.boolean().default(true),
  includeRecentlyPlayed:   z.boolean().default(true),
});

const SecretsSchema = z.object({
  oauth2: z.object({
    access_token:  z.string(),
    refresh_token: z.string().optional(),
    expires_at:    z.number(),
    token_type:    z.string().default('Bearer'),
  }).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topN(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function extractSpotifyId(uri: string): string {
  return uri.split(':').pop() ?? uri;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export class SpotifyConnector implements IPollerConnector {
  readonly manifest: ConnectorManifest = {
    id:          'spotify',
    name:        'Spotify',
    description: 'Tracks your Spotify listening activity — tracks, completions, saved songs, playlists, podcasts, and listening sessions.',
    version:     '0.2.0',
    author:      'Kairosis',
    type:        'poller',
    triggers: [
      SpotifyEventType.TRACK_STARTED,
      SpotifyEventType.TRACK_COMPLETED,
      SpotifyEventType.TRACK_SAVED,
      SpotifyEventType.PLAYLIST_STARTED,
      SpotifyEventType.PODCAST_EPISODE_STARTED,
      SpotifyEventType.PODCAST_EPISODE_COMPLETED,
      SpotifyEventType.ARTIST_PLAYED,
      SpotifyEventType.LISTENING_SESSION_ENDED,
    ],
    requiresAuth:      true,
    authType:          'oauth2',
    setupInstructions: [
      'Go to https://developer.spotify.com/dashboard and create a new app.',
      `Add ${process.env['API_PUBLIC_URL'] ?? 'http://localhost:3200'}/oauth2/callback/spotify as a Redirect URI in the app settings.`,
      'Copy the Client ID into SPOTIFY_CLIENT_ID and the Client Secret into SPOTIFY_CLIENT_SECRET in your .env.',
      'Save this instance, then click the Authorize button to connect your Spotify account.',
    ],
  };

  configSchema()  { return ConfigSchema; }
  secretsSchema() { return SecretsSchema; }

  oauthProvider(): OAuth2Provider {
    return {
      authorizationUrl:   'https://accounts.spotify.com/authorize',
      tokenUrl:           'https://accounts.spotify.com/api/token',
      scopes: [
        'user-read-recently-played',
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-library-read',
      ],
      clientIdEnvVar:     'SPOTIFY_CLIENT_ID',
      clientSecretEnvVar: 'SPOTIFY_CLIENT_SECRET',
    };
  }

  // In-memory caches — survive across poll ticks, reset on process restart
  private readonly artistCache   = new Map<string, SpotifyFullArtist>();
  private readonly playlistCache = new Map<string, SpotifyPlaylist>();

  // ── Poll ──────────────────────────────────────────────────────────────────

  async poll(
    rawConfig:   unknown,
    rawSecrets:  unknown,
    rawState:    unknown,
    workspaceId: string,
  ): Promise<PollResult> {
    const config  = ConfigSchema.parse(rawConfig ?? {});
    const secrets = SecretsSchema.safeParse(rawSecrets ?? {});
    if (!secrets.success) return { events: [], state: rawState };

    const token = secrets.data.oauth2?.access_token;
    if (!token) return { events: [], state: rawState };

    const state  = this.parseState(rawState);
    const events: NormalizedEvent[] = [];
    const now    = new Date().toISOString();
    const nowMs  = Date.now();

    // ── Bootstrap recently played cursor ─────────────────────────────────
    if (config.includeRecentlyPlayed && !state.recentlyPlayedBootstrapped) {
      await this.bootstrapRecentlyPlayed(token, state);
    }

    // ── Currently playing ─────────────────────────────────────────────────
    if (config.includeCurrentlyPlaying) {
      const current = await this.fetchCurrentlyPlaying(token);
      await this.processCurrentlyPlaying(current, state, events, now, token, workspaceId);
    }

    // ── Saved tracks (every 5 min) ────────────────────────────────────────
    if (
      config.includeSavedTracks && (
        state.lastSavedTracksAt === null ||
        nowMs - state.lastSavedTracksAt > SAVED_TRACKS_INTERVAL_MS
      )
    ) {
      const saved = await this.fetchSavedTracks(token);
      this.processSavedTracks(saved, state, events, workspaceId);
      state.lastSavedTracksAt = nowMs;
    }

    return { events, state };
  }

  // ── Recently played bootstrap ─────────────────────────────────────────────

  private async bootstrapRecentlyPlayed(token: string, state: SpotifyState): Promise<void> {
    await this.fetchRecentlyPlayed(token, null); // just warm the cursor
    state.recentlyPlayedBootstrapped = true;
  }

  // ── Currently playing ─────────────────────────────────────────────────────

  private async processCurrentlyPlaying(
    current:     SpotifyCurrentlyPlaying | null,
    state:       SpotifyState,
    events:      NormalizedEvent[],
    now:         string,
    token:       string,
    workspaceId: string,
  ): Promise<void> {
    const isActive = current !== null
      && current.is_playing
      && current.item !== null
      && (current.currently_playing_type === 'track' || current.currently_playing_type === 'episode');

    if (!isActive || !current || !current.item) {
      this.handleIdleOrStopped(state, events, now, workspaceId);
      return;
    }

    state.idleSince = null;
    if (!state.sessionStartedAt) state.sessionStartedAt = now;

    const progressMs = current.progress_ms ?? 0;

    if (current.item.type === 'track') {
      await this.processTrack(
        current.item,
        progressMs,
        current.context,
        state, events, now, token, workspaceId,
      );
    } else if (current.item.type === 'episode') {
      this.processEpisode(current.item, progressMs, state, events, now, workspaceId);
    }
  }

  // ── Track ─────────────────────────────────────────────────────────────────

  private async processTrack(
    track:       SpotifyTrack,
    progressMs:  number,
    context:     SpotifyContext | null,
    state:       SpotifyState,
    events:      NormalizedEvent[],
    now:         string,
    token:       string,
    workspaceId: string,
  ): Promise<void> {
    state.lastEpisodeId = null;
    state.lastEpisode   = null;

    if (track.id !== state.lastTrackId) {
      // ── Close previous track ────────────────────────────────────────────
      if (state.lastTrack) {
        this.closeLastSessionEntry(state);

        if (state.lastProgressMs > state.lastTrack.duration_ms * COMPLETION_THRESHOLD) {
          events.push(this.event(SpotifyEventType.TRACK_COMPLETED, workspaceId, now, {
            id:          state.lastTrack.id,
            type:        'track',
            displayName: `${state.lastTrack.artistName} – ${state.lastTrack.name}`,
            url:         state.lastTrack.url,
          }, {
            trackId:         state.lastTrack.id,
            trackName:       state.lastTrack.name,
            artist:          state.lastTrack.artistName,
            durationMs:      state.lastTrack.duration_ms,
            listenedPercent: Math.round(state.lastProgressMs / state.lastTrack.duration_ms * 100),
          }));
        }
      }

      // ── Enrich: primary artist genres ───────────────────────────────────
      const primaryArtist = track.artists[0] ?? null;
      const artist = primaryArtist ? await this.getArtist(token, primaryArtist.id) : null;
      const genres = artist?.genres ?? [];

      // ── First time hearing this artist ──────────────────────────────────
      if (primaryArtist && !state.heardArtistIds.includes(primaryArtist.id)) {
        state.heardArtistIds.push(primaryArtist.id);
        if (artist) {
          events.push(this.event(SpotifyEventType.ARTIST_PLAYED, workspaceId, now, {
            id:          artist.id,
            type:        'artist',
            displayName: artist.name,
            url:         artist.external_urls.spotify,
          }, {
            artistId:   artist.id,
            artistName: artist.name,
            genres:     artist.genres,
            popularity: artist.popularity,
            url:        artist.external_urls.spotify,
          }));
        }
      }

      // ── Playlist context changed ─────────────────────────────────────────
      if (context?.type === 'playlist' && context.uri !== state.lastContextUri) {
        const playlist = await this.getPlaylist(token, extractSpotifyId(context.uri));
        if (playlist) {
          events.push(this.event(SpotifyEventType.PLAYLIST_STARTED, workspaceId, now, {
            id:          playlist.id,
            type:        'playlist',
            displayName: playlist.name,
            url:         playlist.external_urls.spotify,
          }, {
            playlistId:   playlist.id,
            playlistName: playlist.name,
            trackCount:   playlist.tracks.total,
            owner:        playlist.owner.display_name,
            uri:          context.uri,
          }));
        }
        state.lastContextUri = context.uri;
      } else if ((context?.uri ?? null) !== state.lastContextUri) {
        state.lastContextUri = context?.uri ?? null;
      }

      // ── Emit track started ──────────────────────────────────────────────
      const displayArtist = primaryArtist?.name ?? 'Unknown Artist';
      events.push(this.event(SpotifyEventType.TRACK_STARTED, workspaceId, now, {
        id:          track.id,
        type:        'track',
        displayName: `${displayArtist} – ${track.name}`,
        url:         track.external_urls.spotify,
      }, {
        trackId:          track.id,
        trackName:        track.name,
        artist:           displayArtist,
        artistId:         primaryArtist?.id ?? '',
        album:            track.album.name,
        albumId:          track.album.id,
        durationMs:  track.duration_ms,
        popularity:  track.popularity,
        explicit:    track.explicit,
        url:         track.external_urls.spotify,
        previewUrl:  track.preview_url,
        genres,
        contextType: context?.type,
        contextUri:  context?.uri,
      }));

      // ── Update state ─────────────────────────────────────────────────────
      state.lastTrackId = track.id;
      state.lastTrack   = {
        id:          track.id,
        name:        track.name,
        artistName:  displayArtist,
        artistId:    primaryArtist?.id ?? '',
        duration_ms: track.duration_ms,
        url:         track.external_urls.spotify,
      };

      if (state.sessionTracks.length < 200) {
        state.sessionTracks.push({
          trackId:    track.id,
          trackName:  track.name,
          artist:     displayArtist,
          durationMs: track.duration_ms,
          listenedMs: 0,
          genres,
        });
      }
    }

    state.lastProgressMs = progressMs;
  }

  // ── Episode ───────────────────────────────────────────────────────────────

  private processEpisode(
    episode:     SpotifyEpisode,
    progressMs:  number,
    state:       SpotifyState,
    events:      NormalizedEvent[],
    now:         string,
    workspaceId: string,
  ): void {
    state.lastTrackId = null;
    state.lastTrack   = null;

    if (episode.id !== state.lastEpisodeId) {
      if (state.lastEpisode && state.lastProgressMs > state.lastEpisode.duration_ms * COMPLETION_THRESHOLD) {
        events.push(this.event(SpotifyEventType.PODCAST_EPISODE_COMPLETED, workspaceId, now, {
          id:          state.lastEpisode.id,
          type:        'episode',
          displayName: `${state.lastEpisode.showName} – ${state.lastEpisode.name}`,
          url:         state.lastEpisode.url,
        }, {
          episodeId:       state.lastEpisode.id,
          episodeTitle:    state.lastEpisode.name,
          showName:        state.lastEpisode.showName,
          durationMs:      state.lastEpisode.duration_ms,
          listenedPercent: Math.round(state.lastProgressMs / state.lastEpisode.duration_ms * 100),
        }));
      }

      events.push(this.event(SpotifyEventType.PODCAST_EPISODE_STARTED, workspaceId, now, {
        id:          episode.id,
        type:        'episode',
        displayName: `${episode.show.name} – ${episode.name}`,
        url:         episode.external_urls.spotify,
      }, {
        episodeId:    episode.id,
        episodeTitle: episode.name,
        showName:     episode.show.name,
        showId:       episode.show.id,
        durationMs:   episode.duration_ms,
        description:  episode.description,
        url:          episode.external_urls.spotify,
      }));

      state.lastEpisodeId = episode.id;
      state.lastEpisode   = {
        id:          episode.id,
        name:        episode.name,
        showName:    episode.show.name,
        duration_ms: episode.duration_ms,
        url:         episode.external_urls.spotify,
      };
    }

    state.lastProgressMs = progressMs;
  }

  // ── Idle / session end ────────────────────────────────────────────────────

  private handleIdleOrStopped(
    state:       SpotifyState,
    events:      NormalizedEvent[],
    now:         string,
    workspaceId: string,
  ): void {
    if (!state.sessionStartedAt || state.sessionTracks.length === 0) return;

    if (!state.idleSince) {
      state.idleSince = now;
      return;
    }

    const idleMs = Date.now() - new Date(state.idleSince).getTime();
    if (idleMs >= IDLE_TIMEOUT_MS) {
      this.closeLastSessionEntry(state);
      this.endSession(state, events, now, workspaceId);
    }
  }

  private endSession(
    state:       SpotifyState,
    events:      NormalizedEvent[],
    now:         string,
    workspaceId: string,
  ): void {
    const tracks      = state.sessionTracks;
    const startedAt   = state.sessionStartedAt!;
    const endedAt     = state.idleSince ?? now;
    const durationMs  = new Date(endedAt).getTime() - new Date(startedAt).getTime();

    const allGenres = tracks.flatMap(t => t.genres);
    const skipped   = tracks.filter(t => t.durationMs > 0 && t.listenedMs / t.durationMs < SKIP_THRESHOLD).length;

    events.push(this.event(SpotifyEventType.LISTENING_SESSION_ENDED, workspaceId, endedAt, {
      id:          workspaceId,
      type:        'session',
      displayName: `Listening session — ${tracks.length} track${tracks.length === 1 ? '' : 's'}`,
    }, {
      durationMinutes: Math.max(0, Math.round(durationMs / 60_000)),
      trackCount:      tracks.length,
      topGenres:       topN(allGenres, 3),
      skippedCount:    skipped,
      startedAt,
      endedAt,
    }));

    state.sessionTracks    = [];
    state.sessionStartedAt = null;
    state.idleSince        = null;
  }

  // ── Saved tracks ──────────────────────────────────────────────────────────

  private processSavedTracks(
    items:       SpotifySavedTrackItem[],
    state:       SpotifyState,
    events:      NormalizedEvent[],
    workspaceId: string,
  ): void {
    if (!state.savedTracksBootstrapped) {
      state.savedTrackIds           = items.map(i => i.track.id);
      state.savedTracksBootstrapped = true;
      return;
    }

    const known = new Set(state.savedTrackIds);
    for (const item of items) {
      if (known.has(item.track.id)) continue;
      const track  = item.track;
      const artist = track.artists[0];

      events.push(this.event(SpotifyEventType.TRACK_SAVED, workspaceId, item.added_at, {
        id:          track.id,
        type:        'track',
        displayName: `${artist?.name ?? ''} – ${track.name}`,
        url:         track.external_urls.spotify,
      }, {
        trackId:   track.id,
        trackName: track.name,
        artist:    artist?.name ?? '',
        album:     track.album.name,
        savedAt:   item.added_at,
      }));
    }

    const merged = [...new Set([...items.map(i => i.track.id), ...state.savedTrackIds])];
    state.savedTrackIds = merged.slice(0, 500);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private closeLastSessionEntry(state: SpotifyState): void {
    const last = state.sessionTracks[state.sessionTracks.length - 1];
    if (last && last.trackId === state.lastTrackId && last.listenedMs === 0) {
      last.listenedMs = state.lastProgressMs;
    }
  }

  private event(
    type:        string,
    workspaceId: string,
    occurredAt:  string,
    subject:     { id: string; type: string; displayName?: string; url?: string },
    payload:     Record<string, unknown>,
  ): NormalizedEvent {
    return {
      id:          randomUUID(),
      workspaceId,
      connectorId: this.manifest.id,
      type,
      occurredAt,
      ingestedAt:  new Date().toISOString(),
      version:     '1',
      actor:       undefined,
      subject,
      payload,
    };
  }

  // ── Fetch + cache ─────────────────────────────────────────────────────────

  private async fetchCurrentlyPlaying(token: string): Promise<SpotifyCurrentlyPlaying | null> {
    try {
      const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204 || !res.ok) return null;
      return res.json() as Promise<SpotifyCurrentlyPlaying>;
    } catch { return null; }
  }

  private async fetchArtist(token: string, artistId: string): Promise<SpotifyFullArtist | null> {
    try {
      const res = await fetch(`${SPOTIFY_API}/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<SpotifyFullArtist>;
    } catch { return null; }
  }

  private async fetchRecentlyPlayed(token: string, after: number | null): Promise<SpotifyRecentlyPlayedItem[]> {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (after !== null) params.set('after', String(after));
      const res = await fetch(`${SPOTIFY_API}/me/player/recently-played?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json() as { items: SpotifyRecentlyPlayedItem[] };
      return (data.items ?? []).reverse();
    } catch { return []; }
  }

  private async fetchSavedTracks(token: string): Promise<SpotifySavedTrackItem[]> {
    try {
      const res = await fetch(`${SPOTIFY_API}/me/tracks?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json() as { items: SpotifySavedTrackItem[] };
      return data.items ?? [];
    } catch { return []; }
  }

  private async fetchPlaylist(token: string, playlistId: string): Promise<SpotifyPlaylist | null> {
    try {
      const res = await fetch(
        `${SPOTIFY_API}/playlists/${playlistId}?fields=id,name,tracks.total,owner.display_name,external_urls`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return null;
      return res.json() as Promise<SpotifyPlaylist>;
    } catch { return null; }
  }

  private async getArtist(token: string, artistId: string): Promise<SpotifyFullArtist | null> {
    const hit = this.artistCache.get(artistId);
    if (hit) return hit;
    const result = await this.fetchArtist(token, artistId);
    if (result) this.artistCache.set(artistId, result);
    return result;
  }

  private async getPlaylist(token: string, playlistId: string): Promise<SpotifyPlaylist | null> {
    const hit = this.playlistCache.get(playlistId);
    if (hit) return hit;
    const result = await this.fetchPlaylist(token, playlistId);
    if (result) this.playlistCache.set(playlistId, result);
    return result;
  }

  // ── State parsing ─────────────────────────────────────────────────────────

  private parseState(raw: unknown): SpotifyState {
    const empty: SpotifyState = {
      lastTrackId:                null,
      lastTrack:                  null,
      lastProgressMs:             0,
      lastEpisodeId:              null,
      lastEpisode:                null,
      lastContextUri:             null,
      sessionTracks:              [],
      sessionStartedAt:           null,
      idleSince:                  null,
      savedTrackIds:              [],
      savedTracksBootstrapped:    false,
      heardArtistIds:             [],
      recentlyPlayedBootstrapped: false,
      lastSavedTracksAt:          null,
    };

    if (!raw || typeof raw !== 'object') return empty;
    const s = raw as Partial<SpotifyState>;

    return {
      lastTrackId:                typeof s.lastTrackId === 'string'                ? s.lastTrackId                : null,
      lastTrack:                  s.lastTrack  && typeof s.lastTrack  === 'object' ? s.lastTrack  as StoredTrack  : null,
      lastProgressMs:             typeof s.lastProgressMs === 'number'             ? s.lastProgressMs             : 0,
      lastEpisodeId:              typeof s.lastEpisodeId === 'string'              ? s.lastEpisodeId              : null,
      lastEpisode:                s.lastEpisode && typeof s.lastEpisode === 'object' ? s.lastEpisode as StoredEpisode : null,
      lastContextUri:             typeof s.lastContextUri === 'string'             ? s.lastContextUri             : null,
      sessionTracks:              Array.isArray(s.sessionTracks)                   ? s.sessionTracks              : [],
      sessionStartedAt:           typeof s.sessionStartedAt === 'string'           ? s.sessionStartedAt           : null,
      idleSince:                  typeof s.idleSince === 'string'                  ? s.idleSince                  : null,
      savedTrackIds:              Array.isArray(s.savedTrackIds)                   ? s.savedTrackIds              : [],
      savedTracksBootstrapped:    typeof s.savedTracksBootstrapped === 'boolean'   ? s.savedTracksBootstrapped    : false,
      heardArtistIds:             Array.isArray(s.heardArtistIds)                  ? s.heardArtistIds             : [],
      recentlyPlayedBootstrapped: typeof s.recentlyPlayedBootstrapped === 'boolean' ? s.recentlyPlayedBootstrapped : false,
      lastSavedTracksAt:          typeof s.lastSavedTracksAt === 'number'          ? s.lastSavedTracksAt          : null,
    };
  }
}

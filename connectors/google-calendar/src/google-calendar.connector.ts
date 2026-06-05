import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { IPollerConnector, ConnectorManifest, PollResult } from '@kairosis/connectors';
import { CalendarEventType } from '@kairosis/calendar-events';
import { NormalizedEvent } from '@kairosis/events-core';

const ConfigSchema = z.object({
  calendarId:   z.string().default('primary'),
  lookbackDays: z.coerce.number().int().positive().catch(7),
});

const SecretsSchema = z.object({
  clientId:     z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});

interface CalendarState {
  syncToken: string | null;
}

interface GoogleCalendarEvent {
  id:               string;
  summary?:         string;
  description?:     string;
  location?:        string;
  status:           'confirmed' | 'tentative' | 'cancelled';
  created:          string;
  updated:          string;
  htmlLink?:        string;
  recurringEventId?: string;
  start:            { dateTime?: string; date?: string };
  end:              { dateTime?: string; date?: string };
  organizer?:       { email: string; displayName?: string; self?: boolean };
  attendees?:       { email: string; displayName?: string; responseStatus?: string; self?: boolean }[];
}

interface ListEventsResponse {
  items?:         GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export class GoogleCalendarConnector implements IPollerConnector {
  readonly manifest: ConnectorManifest = {
    id:          'google-calendar',
    name:        'Google Calendar',
    description: 'Polls Google Calendar for new, updated, and deleted events.',
    version:     '0.1.0',
    author:      'Kairosis',
    type:        'poller',
    triggers:    [CalendarEventType.EVENT_CREATED, CalendarEventType.EVENT_UPDATED, CalendarEventType.EVENT_DELETED],
    requiresAuth: true,
    authType:    'oauth2',
    setupInstructions: [
      'Go to console.cloud.google.com, create a project and enable the Google Calendar API.',
      'Under "APIs & Services → Credentials", create an OAuth 2.0 Client ID (type: Desktop App). Copy the Client ID and Client Secret.',
      'Open https://developers.google.com/oauthplayground — click the gear icon, check "Use your own OAuth credentials" and enter your Client ID and Secret.',
      'In Step 1, enter scope: https://www.googleapis.com/auth/calendar.readonly — click "Authorize APIs" and sign in.',
      'In Step 2, click "Exchange authorization code for tokens". Copy the Refresh Token.',
      'Paste Client ID, Client Secret, and Refresh Token into the Secrets fields below.',
    ],
  };

  configSchema()  { return ConfigSchema; }
  secretsSchema() { return SecretsSchema; }

  async poll(
    rawConfig: unknown,
    rawSecrets: unknown,
    rawState: unknown,
    workspaceId: string,
  ): Promise<PollResult> {
    const config  = ConfigSchema.parse(rawConfig);
    const secrets = SecretsSchema.parse(rawSecrets);
    const state   = this.parseState(rawState);

    const accessToken = await this.getAccessToken(secrets);
    const { items, nextSyncToken } = await this.fetchChanges(accessToken, config, state);

    const now = new Date().toISOString();
    const events: NormalizedEvent[] = [];

    for (const item of items) {
      const type = this.resolveEventType(item);
      if (!type) continue;

      const start   = item.start.dateTime ?? item.start.date ?? now;
      const end     = item.end.dateTime   ?? item.end.date   ?? now;
      const allDay  = !item.start.dateTime;
      const title   = item.summary ?? '(no title)';

      events.push({
        id:          randomUUID(),
        workspaceId,
        connectorId: this.manifest.id,
        type,
        occurredAt:  item.updated ?? now,
        ingestedAt:  now,
        version:     '1',
        actor: item.organizer
          ? {
              id:          item.organizer.email,
              type:        'user' as const,
              displayName: item.organizer.displayName ?? item.organizer.email,
            }
          : undefined,
        subject: {
          id:          item.id,
          type:        'calendar_event',
          displayName: title,
          url:         item.htmlLink,
        },
        payload: {
          eventId:     item.id,
          calendarId:  config.calendarId,
          title,
          description: item.description,
          start,
          end,
          allDay,
          location:    item.location,
          status:      item.status,
          organizer:   item.organizer,
          attendees:   item.attendees ?? [],
          htmlLink:    item.htmlLink,
          recurring:   !!item.recurringEventId,
        },
        raw: item,
      });
    }

    return {
      events,
      state: { syncToken: nextSyncToken ?? state.syncToken },
    };
  }

  private resolveEventType(item: GoogleCalendarEvent): string | null {
    if (item.status === 'cancelled') return CalendarEventType.EVENT_DELETED;
    const createdMs = new Date(item.created).getTime();
    const updatedMs = new Date(item.updated).getTime();
    return Math.abs(updatedMs - createdMs) < 2000
      ? CalendarEventType.EVENT_CREATED
      : CalendarEventType.EVENT_UPDATED;
  }

  private async getAccessToken(secrets: z.infer<typeof SecretsSchema>): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: secrets.refreshToken,
        client_id:     secrets.clientId,
        client_secret: secrets.clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to refresh access token: ${res.status} ${body}`);
    }

    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  private async fetchChanges(
    accessToken: string,
    config: z.infer<typeof ConfigSchema>,
    state: CalendarState,
  ): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
    if (state.syncToken) {
      return this.fetchIncremental(accessToken, config.calendarId, state.syncToken);
    }
    return this.fetchInitial(accessToken, config.calendarId, config.lookbackDays);
  }

  private async fetchInitial(
    accessToken: string,
    calendarId: string,
    lookbackDays: number,
  ): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - lookbackDays);

    const params = new URLSearchParams({
      timeMin:       timeMin.toISOString(),
      singleEvents:  'true',
      orderBy:       'updated',
      maxResults:    '250',
      showDeleted:   'false',
    });

    return this.paginateEvents(accessToken, calendarId, params);
  }

  private async fetchIncremental(
    accessToken: string,
    calendarId: string,
    syncToken: string,
  ): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
    const params = new URLSearchParams({
      syncToken,
      showDeleted: 'true',
    });

    try {
      return await this.paginateEvents(accessToken, calendarId, params);
    } catch (err) {
      // 410 Gone means the syncToken expired — reset to a full initial sync
      if (err instanceof Error && err.message.includes('410')) {
        return this.fetchInitial(accessToken, calendarId, 7);
      }
      throw err;
    }
  }

  private async paginateEvents(
    accessToken: string,
    calendarId: string,
    params: URLSearchParams,
  ): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
    const base    = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const all: GoogleCalendarEvent[] = [];
    let nextSyncToken: string | undefined;

    let pageToken: string | undefined;
    do {
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`${base}?${params}`, { headers });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Calendar API error: ${res.status} ${body}`);
      }

      const data = await res.json() as ListEventsResponse;
      all.push(...(data.items ?? []));
      nextSyncToken = data.nextSyncToken;
      pageToken     = data.nextPageToken;
    } while (pageToken);

    return { items: all, nextSyncToken };
  }

  private parseState(raw: unknown): CalendarState {
    if (raw && typeof raw === 'object' && 'syncToken' in raw) {
      const t = (raw as Record<string, unknown>)['syncToken'];
      if (typeof t === 'string') return { syncToken: t };
    }
    return { syncToken: null };
  }
}

import { z } from 'zod';

const AttendeeSchema = z.object({
  email:          z.string(),
  displayName:    z.string().optional(),
  responseStatus: z.string().optional(),
  self:           z.boolean().optional(),
});

const OrganizerSchema = z.object({
  email:       z.string(),
  displayName: z.string().optional(),
  self:        z.boolean().optional(),
});

export const CalendarEventPayload = z.object({
  eventId:     z.string(),
  calendarId:  z.string(),
  title:       z.string(),
  description: z.string().optional(),
  start:       z.string(),
  end:         z.string(),
  allDay:      z.boolean(),
  location:    z.string().optional(),
  status:      z.enum(['confirmed', 'tentative', 'cancelled']),
  organizer:   OrganizerSchema.optional(),
  attendees:   z.array(AttendeeSchema).default([]),
  htmlLink:    z.string().optional(),
  recurring:   z.boolean().default(false),
});

export type CalendarEvent = z.infer<typeof CalendarEventPayload>;

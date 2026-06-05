export const LocationEventType = {
  POSITION_UPDATED: 'location.position.updated',
  GEOFENCE_ENTERED: 'location.geofence.entered',
  GEOFENCE_EXITED: 'location.geofence.exited',
} as const;

export type LocationEventTypeValue = typeof LocationEventType[keyof typeof LocationEventType];

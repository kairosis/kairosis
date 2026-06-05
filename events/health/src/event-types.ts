export const HealthEventType = {
  HEARTBEAT: 'health.heartbeat',
  METRIC_RECORDED: 'health.metric.recorded',
  SLEEP_STARTED: 'health.sleep.started',
  SLEEP_ENDED: 'health.sleep.ended',
} as const;

export type HealthEventTypeValue = typeof HealthEventType[keyof typeof HealthEventType];

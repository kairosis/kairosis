export const SynthesizedEventType = {
  PATTERN_DETECTED: 'synthesized.pattern.detected',
  SUMMARY_GENERATED: 'synthesized.summary.generated',
} as const;

export type SynthesizedEventTypeValue = typeof SynthesizedEventType[keyof typeof SynthesizedEventType];

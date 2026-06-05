export const TerminalEventType = {
  COMMAND_EXECUTED: 'terminal.command.executed',
  DIRECTORY_CHANGED: 'terminal.directory.changed',
} as const;

export type TerminalEventTypeValue = typeof TerminalEventType[keyof typeof TerminalEventType];

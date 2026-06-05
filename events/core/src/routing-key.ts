export const RoutingKey = {
  ALL: '#',
  EMAIL_ALL: 'email.#',
  GITHUB_ALL: 'github.#',
  GITHUB_PR_ALL: 'github.pr.#',
  SLACK_ALL: 'slack.#',
  HEALTH_ALL: 'health.#',
  CALENDAR_ALL: 'calendar.#',
  BROWSER_ALL: 'browser.#',
  TERMINAL_ALL: 'terminal.#',
  LOCATION_ALL: 'location.#',
  OBSIDIAN_ALL: 'obsidian.#',
  NOTION_ALL: 'notion.#',
  SYNTHESIZED_ALL: 'synthesized.#',

  from: (eventType: string): string => eventType,
} as const;

export const GithubEventType = {
  COMMIT_PUSHED:   'github.commit.pushed',
  PR_OPENED:       'github.pr.opened',
  PR_MERGED:       'github.pr.merged',
  PR_CLOSED:       'github.pr.closed',
  PR_REVIEWED:     'github.pr.reviewed',
  ISSUE_OPENED:    'github.issue.opened',
  ISSUE_CLOSED:    'github.issue.closed',
  ISSUE_REOPENED:  'github.issue.reopened',
  ISSUE_COMMENTED: 'github.issue.commented',
  RELEASE_CREATED: 'github.release.created',
} as const;

export type GithubEventTypeValue = typeof GithubEventType[keyof typeof GithubEventType];

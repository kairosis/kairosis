export class ClaimCheckExpiredError extends Error {
  readonly expiresAt: string;
  readonly objectKey: string;

  constructor(expiresAt: string, objectKey: string) {
    super(`Claim-check URL expired at ${expiresAt} (object: ${objectKey})`);
    this.name      = 'ClaimCheckExpiredError';
    this.expiresAt = expiresAt;
    this.objectKey = objectKey;
  }
}

export class ClaimCheckFetchError extends Error {
  readonly status: number;
  readonly objectKey: string;

  constructor(status: number, statusText: string, objectKey: string) {
    super(`Failed to fetch claim-check payload: ${status} ${statusText} (object: ${objectKey})`);
    this.name      = 'ClaimCheckFetchError';
    this.status    = status;
    this.objectKey = objectKey;
  }
}

export class ClaimCheckTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly objectKey: string;

  constructor(timeoutMs: number, objectKey: string) {
    super(`Claim-check fetch timed out after ${timeoutMs}ms (object: ${objectKey})`);
    this.name      = 'ClaimCheckTimeoutError';
    this.timeoutMs = timeoutMs;
    this.objectKey = objectKey;
  }
}

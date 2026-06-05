import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { CryptoService } from '@kairosis/crypto';
import { OAuth2Provider, OAuth2StatePayload, OAuth2TokenSet } from './types/oauth2.types';

const REDIRECT_BASE = () => process.env['API_PUBLIC_URL'] ?? 'http://localhost:3200';
const STATE_TTL_MS  = 10 * 60 * 1000;  // 10 minutes

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);

  constructor(
    private readonly configService: ConnectorConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ─── Authorization URL ────────────────────────────────────────────────────

  buildAuthUrl(
    provider:    OAuth2Provider,
    workspaceId: string,
    connectorId: string,
    instanceId:  string,
  ): string {
    const state  = this.signState({ workspaceId, connectorId, instanceId,
                                    nonce: randomBytes(16).toString('hex'),
                                    exp: Date.now() + STATE_TTL_MS });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     this.clientId(provider),
      redirect_uri:  this.redirectUri(connectorId),
      scope:         provider.scopes.join(provider.scopeSeparator ?? ' '),
      state,
      ...provider.extraAuthParams,
    });
    return `${provider.authorizationUrl}?${params}`;
  }

  // ─── Callback ─────────────────────────────────────────────────────────────

  async handleCallback(
    provider: OAuth2Provider,
    code:     string,
    state:    string,
  ): Promise<{ workspaceId: string; connectorId: string; instanceId: string }> {
    const payload = this.verifyState(state);
    if (!payload) throw new UnauthorizedException('Invalid or expired OAuth2 state');

    const { workspaceId, connectorId, instanceId } = payload;

    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  this.redirectUri(connectorId),
      client_id:     this.clientId(provider),
      client_secret: this.clientSecret(provider),
    });

    const res = await fetch(provider.tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                 'Accept': 'application/json' },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Token exchange failed for ${connectorId}: ${err}`);
      throw new Error(`Token exchange failed: ${res.status}`);
    }

    const raw = await res.json() as Record<string, unknown>;
    const tokens = this.normalizeTokenResponse(raw);

    await this.storeTokens(instanceId, tokens);
    this.logger.log(`OAuth2 tokens stored for ${connectorId} instance ${instanceId}`);

    return { workspaceId, connectorId, instanceId };
  }

  // ─── Access token (with auto-refresh) ────────────────────────────────────

  async getAccessToken(
    provider:    OAuth2Provider,
    workspaceId: string,
    connectorId: string,
    instanceId:  string,
  ): Promise<string> {
    const tokens = await this.loadTokens(instanceId);
    if (!tokens) throw new NotFoundException(`No OAuth2 tokens for instance ${instanceId}`);

    if (this.isExpiringSoon(tokens)) {
      return this.refreshToken(provider, workspaceId, connectorId, instanceId);
    }

    return tokens.access_token;
  }

  // ─── Refresh (public — also called by TokenRefreshService) ───────────────

  async refreshToken(
    provider:    OAuth2Provider,
    _workspaceId: string,
    connectorId: string,
    instanceId:  string,
  ): Promise<string> {
    const tokens = await this.loadTokens(instanceId);
    if (!tokens?.refresh_token) {
      throw new Error(`No refresh token available for instance ${instanceId}`);
    }

    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id:     this.clientId(provider),
      client_secret: this.clientSecret(provider),
    });

    const res = await fetch(provider.tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                 'Accept': 'application/json' },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Token refresh failed for ${connectorId}: ${err}`);
      throw new Error(`Token refresh failed: ${res.status}`);
    }

    const raw = await res.json() as Record<string, unknown>;
    const fresh = this.normalizeTokenResponse(raw, tokens.refresh_token);

    await this.storeTokens(instanceId, fresh);
    this.logger.log(`Refreshed OAuth2 token for ${connectorId} instance ${instanceId}`);

    return fresh.access_token;
  }

  isExpiringSoon(tokens: OAuth2TokenSet, windowMs = 5 * 60_000): boolean {
    return Date.now() >= tokens.expires_at - windowMs;
  }

  // ─── Token storage ────────────────────────────────────────────────────────

  async loadTokens(instanceId: string): Promise<OAuth2TokenSet | null> {
    const config = await this.configService.findById(instanceId);
    if (!config?.secrets) return null;

    const secrets = JSON.parse(this.cryptoService.decrypt(config.secrets)) as Record<string, unknown>;
    const oauth2 = secrets['oauth2'] as OAuth2TokenSet | undefined;
    return oauth2 ?? null;
  }

  private async storeTokens(instanceId: string, tokens: OAuth2TokenSet): Promise<void> {
    const config = await this.configService.findById(instanceId);
    if (!config) throw new NotFoundException(`Instance ${instanceId} not found`);

    const existing: Record<string, unknown> = config.secrets
      ? JSON.parse(this.cryptoService.decrypt(config.secrets))
      : {};

    const merged = { ...existing, oauth2: tokens };
    const encrypted = this.cryptoService.encrypt(JSON.stringify(merged));
    await this.configService.update(instanceId, { secrets: encrypted });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private normalizeTokenResponse(
    raw: Record<string, unknown>,
    fallbackRefreshToken?: string,
  ): OAuth2TokenSet {
    const expiresIn = typeof raw['expires_in'] === 'number' ? raw['expires_in'] : 3600;
    return {
      access_token:  raw['access_token'] as string,
      refresh_token: (raw['refresh_token'] as string | undefined) ?? fallbackRefreshToken,
      expires_at:    Date.now() + expiresIn * 1000,
      token_type:    (raw['token_type'] as string | undefined) ?? 'Bearer',
      scope:         raw['scope'] as string | undefined,
    };
  }

  private redirectUri(connectorId: string): string {
    return `${REDIRECT_BASE()}/oauth2/callback/${connectorId}`;
  }

  private clientId(provider: OAuth2Provider): string {
    const val = process.env[provider.clientIdEnvVar];
    if (!val) throw new Error(`Missing env var: ${provider.clientIdEnvVar}`);
    return val;
  }

  private clientSecret(provider: OAuth2Provider): string {
    const val = process.env[provider.clientSecretEnvVar];
    if (!val) throw new Error(`Missing env var: ${provider.clientSecretEnvVar}`);
    return val;
  }

  // ─── State signing ────────────────────────────────────────────────────────

  private signState(payload: OAuth2StatePayload): string {
    const key  = process.env['ENCRYPTION_KEY'] ?? '';
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig  = createHmac('sha256', key).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  private verifyState(state: string): OAuth2StatePayload | null {
    try {
      const dot = state.lastIndexOf('.');
      if (dot === -1) return null;

      const data = state.slice(0, dot);
      const sig  = state.slice(dot + 1);
      const key  = process.env['ENCRYPTION_KEY'] ?? '';
      const expected = createHmac('sha256', key).update(data).digest('base64url');

      if (!timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) {
        return null;
      }

      const payload: OAuth2StatePayload = JSON.parse(Buffer.from(data, 'base64url').toString());
      if (Date.now() > payload.exp) return null;

      return payload;
    } catch {
      return null;
    }
  }
}

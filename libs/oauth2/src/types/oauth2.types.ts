import type { IKairosisConnector } from '@kairosis/connectors';
import type { OAuth2Connector } from '@kairosis/connector-sdk';

export type { OAuth2Provider, OAuth2Connector } from '@kairosis/connector-sdk';

export function isOAuth2Connector(
  connector: IKairosisConnector,
): connector is IKairosisConnector & OAuth2Connector {
  return typeof (connector as unknown as OAuth2Connector).oauthProvider === 'function';
}

export interface OAuth2TokenSet {
  access_token:  string;
  refresh_token?: string;
  expires_at:    number;   // unix ms
  token_type:    string;
  scope?:        string;
}

export interface OAuth2StatePayload {
  workspaceId: string;
  connectorId: string;
  instanceId:  string;
  nonce:       string;
  exp:         number;     // unix ms
}

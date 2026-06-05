import { IKairosisConnector } from '@kairosis/connectors';

export interface OAuth2Provider {
  authorizationUrl: string;
  tokenUrl:         string;
  scopes:           string[];
  /** Defaults to ' ' (space). Some providers use ',' */
  scopeSeparator?:  string;
  /** Name of the env var holding the client ID */
  clientIdEnvVar:   string;
  /** Name of the env var holding the client secret */
  clientSecretEnvVar: string;
  /** Extra query params appended to the authorization URL */
  extraAuthParams?: Record<string, string>;
}

export interface OAuth2Connector {
  oauthProvider(): OAuth2Provider;
}

export function isOAuth2Connector(
  connector: IKairosisConnector,
): connector is IKairosisConnector & OAuth2Connector {
  return typeof (connector as unknown as OAuth2Connector).oauthProvider === 'function';
}

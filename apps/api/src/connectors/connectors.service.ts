import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConnectorRegistry, IKairosisConnector, IWebhookConnector } from '@kairosis/connectors';
import { ConnectorConfigService } from '@kairosis/connector-config';
import { CryptoService } from '@kairosis/crypto';

const API_URL = () => process.env['API_PUBLIC_URL'] ?? 'http://localhost:3200';

function endpointUrl(connector: IKairosisConnector, token: string): string {
  if (connector.manifest.type === 'device') {
    return `${API_URL()}/device/${connector.manifest.id}/${token}`;
  }
  return `${API_URL()}/webhooks/${connector.manifest.id}/${token}`;
}

function ingestUrl(connector: IKairosisConnector): string {
  return `${API_URL()}/ingest/${connector.manifest.id}`;
}

function usesApiKeyAuth(connector: IKairosisConnector): boolean {
  return connector.manifest.authType === 'apikey';
}

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly configService: ConnectorConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  getDetail(id: string) {
    const connector = ConnectorRegistry.get(id);
    if (!connector) throw new NotFoundException(`Connector '${id}' not found`);

    return {
      manifest:      connector.manifest,
      configSchema:  zodToJsonSchema(connector.configSchema(),  { name: 'config' }),
      secretsSchema: connector.secretsSchema
        ? zodToJsonSchema(connector.secretsSchema(), { name: 'secrets' })
        : null,
    };
  }

  async listInstances(connectorId: string, workspaceId: string) {
    const connector = ConnectorRegistry.get(connectorId);
    if (!connector) throw new NotFoundException(`Connector '${connectorId}' not found`);

    const entities = await this.configService.findAllByWorkspaceAndConnector(workspaceId, connectorId);

    return entities.map((e) => ({
      id:         e.id,
      name:       e.instanceName,
      enabled:    e.enabled,
      hasSecrets: !!e.secrets,
      webhookUrl: e.webhookToken ? endpointUrl(connector, e.webhookToken) : null,
      ingestUrl:  usesApiKeyAuth(connector) ? ingestUrl(connector) : null,
    }));
  }

  async getInstance(connectorId: string, instanceId: string) {
    const connector = ConnectorRegistry.get(connectorId);
    if (!connector) throw new NotFoundException(`Connector '${connectorId}' not found`);

    const entity = await this.configService.findById(instanceId);
    if (!entity || entity.connectorId !== connectorId) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }

    return {
      id:         entity.id,
      name:       entity.instanceName,
      enabled:    entity.enabled,
      hasSecrets: !!entity.secrets,
      webhookUrl: entity.webhookToken ? endpointUrl(connector, entity.webhookToken) : null,
      ingestUrl:  usesApiKeyAuth(connector) ? ingestUrl(connector) : null,
      config:     entity.config,
    };
  }

  async createInstance(
    connectorId: string,
    workspaceId: string,
    name: string | undefined,
    enabled: boolean,
    config: Record<string, unknown>,
    secrets?: Record<string, unknown>,
  ) {
    const connector = ConnectorRegistry.get(connectorId);
    if (!connector) throw new NotFoundException(`Connector '${connectorId}' not found`);

    const needsToken = (connector.manifest.type === 'webhook' || connector.manifest.type === 'device')
      && !usesApiKeyAuth(connector);
    const webhookToken = needsToken ? randomUUID().replace(/-/g, '') : null;

    const encryptedSecrets =
      secrets && Object.keys(secrets).length > 0
        ? this.cryptoService.encrypt(JSON.stringify(secrets))
        : null;

    const entity = await this.configService.create(workspaceId, connectorId, {
      instanceName: name ?? null,
      enabled,
      config,
      secrets:      encryptedSecrets,
      webhookToken,
    });

    return {
      id:         entity.id,
      webhookUrl: webhookToken ? endpointUrl(connector, webhookToken) : null,
      ingestUrl:  usesApiKeyAuth(connector) ? ingestUrl(connector) : null,
    };
  }

  async updateInstance(
    connectorId: string,
    instanceId: string,
    name: string | undefined,
    enabled: boolean,
    config: Record<string, unknown>,
    secrets?: Record<string, unknown>,
  ) {
    const connector = ConnectorRegistry.get(connectorId);
    if (!connector) throw new NotFoundException(`Connector '${connectorId}' not found`);

    const existing = await this.configService.findById(instanceId);
    if (!existing || existing.connectorId !== connectorId) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }

    const encryptedSecrets =
      secrets && Object.keys(secrets).length > 0
        ? this.cryptoService.encrypt(JSON.stringify(secrets))
        : existing.secrets;

    await this.configService.update(instanceId, {
      instanceName: name !== undefined ? (name || null) : existing.instanceName,
      enabled,
      config,
      secrets: encryptedSecrets,
    });

    return {
      webhookUrl: existing.webhookToken ? endpointUrl(connector, existing.webhookToken) : null,
    };
  }

  async deleteInstance(connectorId: string, instanceId: string) {
    const existing = await this.configService.findById(instanceId);
    if (!existing || existing.connectorId !== connectorId) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }
    await this.configService.remove(instanceId);
    return { ok: true };
  }

  async testInstance(connectorId: string, instanceId: string): Promise<{ ok: boolean; message: string }> {
    const connector = ConnectorRegistry.get(connectorId);
    if (!connector) throw new NotFoundException(`Connector '${connectorId}' not found`);

    const entity = await this.configService.findById(instanceId);
    if (!entity || entity.connectorId !== connectorId) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }

    if (!entity.enabled) {
      return { ok: false, message: 'Instance is disabled. Enable it first.' };
    }

    return { ok: true, message: `${connector.manifest.name} is active and ready to receive events.` };
  }
}

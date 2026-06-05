import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectorRegistry, IPollerConnector } from '@kairosis/connectors';
import { ConnectorConfigEntity, ConnectorConfigService } from '@kairosis/connector-config';
import { CryptoService } from '@kairosis/crypto';
import { MessagingService } from '@kairosis/messaging';
import { TenantContext } from '@kairosis/tenant';
import { NormalizedEvent, NormalizedEventSchema } from '@kairosis/events-core';

@Injectable()
export class PollerScheduler {
  private readonly logger = new Logger(PollerScheduler.name);
  private running = false;

  constructor(
    private readonly configService: ConnectorConfigService,
    private readonly cryptoService: CryptoService,
    private readonly messagingService: MessagingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous cycle still running — skipping tick');
      return;
    }
    this.running = true;
    try {
      await this.runCycle();
    } finally {
      this.running = false;
    }
  }

  private async runCycle(): Promise<void> {
    const all = await this.configService.findEnabledPollers();

    const pollers = all.filter((c) => {
      const connector = ConnectorRegistry.get(c.connectorId);
      return connector && typeof (connector as IPollerConnector).poll === 'function';
    });

    if (pollers.length === 0) return;

    this.logger.log(`Polling ${pollers.length} instance(s)`);
    for (const config of pollers) {
      await this.pollOne(config);
    }
  }

  private async pollOne(config: ConnectorConfigEntity): Promise<void> {
    const connector = ConnectorRegistry.get(config.connectorId) as IPollerConnector;

    let secrets: unknown = {};
    try {
      secrets = config.secrets
        ? JSON.parse(this.cryptoService.decrypt(config.secrets))
        : {};
    } catch (err) {
      this.logger.error(`Failed to decrypt secrets for ${config.connectorId} [${config.id}]`, err);
      return;
    }

    let result: { events: NormalizedEvent[]; state?: unknown };
    try {
      result = await TenantContext.run({ workspaceId: config.workspaceId }, () =>
        connector.poll(config.config, secrets, config.state, config.workspaceId),
      );
    } catch (err) {
      this.logger.error(`Poll error for ${config.connectorId} [${config.id}]`, err);
      return;
    }

    if (result.state !== undefined) {
      await this.configService.update(config.id, { state: result.state });
    }

    let published = 0;
    for (const raw of result.events) {
      try {
        const event = NormalizedEventSchema.parse(raw);
        await this.messagingService.publish(event);
        published++;
      } catch (err) {
        this.logger.warn(`Invalid event from ${config.connectorId} [${config.id}] — skipping`, err);
      }
    }

    if (published > 0) {
      this.logger.log(`${config.connectorId} [${config.id}]: published ${published} event(s)`);
    }
  }
}

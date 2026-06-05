import { IKairosisConnector } from './interfaces';

export class ConnectorRegistry {
  private static readonly connectors = new Map<string, IKairosisConnector>();

  static register(connector: IKairosisConnector): void {
    this.connectors.set(connector.manifest.id, connector);
  }

  static get(id: string): IKairosisConnector | undefined {
    return this.connectors.get(id);
  }

  static getAll(): IKairosisConnector[] {
    return Array.from(this.connectors.values());
  }

  static has(id: string): boolean {
    return this.connectors.has(id);
  }
}

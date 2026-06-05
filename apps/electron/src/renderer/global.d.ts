interface Config {
  apiEndpoint: string;
  apiKey:      string;
  events: {
    activeApp:  boolean;
    screenLock: boolean;
    idle:       boolean;
    battery:    boolean;
  };
  blockedApps: string[];
}

interface Status {
  connected: boolean | null;
  lastAt:    string | null;
  error:     string | null;
}

interface Window {
  kairosis: {
    getVersion(): Promise<string>;
    getConfig():  Promise<Config>;
    setConfig(c: Config): Promise<void>;
    getStatus():  Promise<Status>;
  };
}

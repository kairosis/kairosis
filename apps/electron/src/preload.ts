import { contextBridge, ipcRenderer } from 'electron';
import type { Config } from './main';

const api = {
  getVersion: (): Promise<string>  => ipcRenderer.invoke('app:version'),
  getConfig:  (): Promise<Config>  => ipcRenderer.invoke('config:get'),
  setConfig:  (c: Config): Promise<void> => ipcRenderer.invoke('config:set', c),
  getStatus:  (): Promise<{ connected: boolean | null; lastAt: string | null; error: string | null }> => ipcRenderer.invoke('status:get'),
};

contextBridge.exposeInMainWorld('kairosis', api);

export type KairosisAPI = typeof api;

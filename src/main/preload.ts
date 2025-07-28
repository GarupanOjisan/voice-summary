import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスで使用するAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
  // 音声関連
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startAudioCapture: (deviceId: string) =>
    ipcRenderer.invoke('start-audio-capture', deviceId),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),

  // ファイル関連
  saveFile: (data: any, filename: string) =>
    ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),

  // 設定関連
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) =>
    ipcRenderer.invoke('save-settings', settings),

  // イベントリスナー
  onAudioData: (callback: (data: any) => void) => {
    ipcRenderer.on('audio-data', (_, data) => callback(data));
  },
  onTranscriptionUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('transcription-update', (_, data) => callback(data));
  },
  onSummaryUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('summary-update', (_, data) => callback(data));
  },
});

// TypeScript型定義
declare global {
  interface Window {
    electronAPI: {
      getAudioDevices: () => Promise<any[]>;
      startAudioCapture: (
        deviceId: string
      ) => Promise<{ success: boolean; error?: string }>;
      stopAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      saveFile: (data: any, filename: string) => Promise<void>;
      openFile: () => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      onAudioData: (callback: (data: any) => void) => void;
      onTranscriptionUpdate: (callback: (data: any) => void) => void;
      onSummaryUpdate: (callback: (data: any) => void) => void;
    };
  }
}

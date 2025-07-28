import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスで使用するAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
  // 音声関連
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startAudioCapture: (deviceId: string) =>
    ipcRenderer.invoke('start-audio-capture', deviceId),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  getAudioQualityStats: () => ipcRenderer.invoke('get-audio-quality-stats'),
  getBufferInfo: () => ipcRenderer.invoke('get-buffer-info'),
  updateAudioProcessorOptions: (options: any) =>
    ipcRenderer.invoke('update-audio-processor-options', options),

  // 仮想オーディオデバイス関連
  getVirtualAudioDeviceConfig: () =>
    ipcRenderer.invoke('get-virtual-audio-device-config'),
  createVirtualAudioDevice: () =>
    ipcRenderer.invoke('create-virtual-audio-device'),
  getAudioRoutingConfig: () => ipcRenderer.invoke('get-audio-routing-config'),
  updateAudioRouting: (config: any) =>
    ipcRenderer.invoke('update-audio-routing', config),
  startVirtualAudioCapture: (deviceName: string) =>
    ipcRenderer.invoke('start-virtual-audio-capture', deviceName),
  startMixedAudioCapture: (systemDevice: string, micDevice: string) =>
    ipcRenderer.invoke('start-mixed-audio-capture', systemDevice, micDevice),

  // Whisper関連
  getWhisperModels: () => ipcRenderer.invoke('get-whisper-models'),
  getDownloadedWhisperModels: () =>
    ipcRenderer.invoke('get-downloaded-whisper-models'),
  downloadWhisperModel: (modelName: string) =>
    ipcRenderer.invoke('download-whisper-model', modelName),
  initializeWhisper: (modelName: string) =>
    ipcRenderer.invoke('initialize-whisper', modelName),
  startStreamingTranscription: (options: any) =>
    ipcRenderer.invoke('start-streaming-transcription', options),
  stopStreamingTranscription: () =>
    ipcRenderer.invoke('stop-streaming-transcription'),
  getWhisperSettings: () => ipcRenderer.invoke('get-whisper-settings'),
  getStreamingTranscriptionInfo: () =>
    ipcRenderer.invoke('get-streaming-transcription-info'),

  // STTマネージャー関連
  getSupportedSttProviders: () => ipcRenderer.invoke('get-supported-stt-providers'),
  getSttProviderInfo: (providerType: string) => ipcRenderer.invoke('get-stt-provider-info', providerType),
  getSttProviderStatus: () => ipcRenderer.invoke('get-stt-provider-status'),
  initializeSttProvider: (providerType: string) => ipcRenderer.invoke('initialize-stt-provider', providerType),
  switchSttProvider: (providerType: string) => ipcRenderer.invoke('switch-stt-provider', providerType),
  startSttStreaming: (options: any) => ipcRenderer.invoke('start-stt-streaming', options),
  stopSttStreaming: () => ipcRenderer.invoke('stop-stt-streaming'),
  getCurrentSttProvider: () => ipcRenderer.invoke('get-current-stt-provider'),
  updateSttConfig: (config: any) => ipcRenderer.invoke('update-stt-config', config),

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
      getAudioQualityStats: () => Promise<any>;
      getBufferInfo: () => Promise<any>;
      updateAudioProcessorOptions: (
        options: any
      ) => Promise<{ success: boolean; error?: string }>;
      getVirtualAudioDeviceConfig: () => Promise<any>;
      createVirtualAudioDevice: () => Promise<{
        success: boolean;
        message: string;
      }>;
      getAudioRoutingConfig: () => Promise<any>;
      updateAudioRouting: (
        config: any
      ) => Promise<{ success: boolean; error?: string }>;
      startVirtualAudioCapture: (
        deviceName: string
      ) => Promise<{ success: boolean; error?: string }>;
      startMixedAudioCapture: (
        systemDevice: string,
        micDevice: string
      ) => Promise<{ success: boolean; error?: string }>;
      getWhisperModels: () => Promise<any[]>;
      getDownloadedWhisperModels: () => Promise<string[]>;
      downloadWhisperModel: (
        modelName: string
      ) => Promise<{ success: boolean; error?: string }>;
      initializeWhisper: (
        modelName: string
      ) => Promise<{ success: boolean; error?: string }>;
      startStreamingTranscription: (
        options: any
      ) => Promise<{ success: boolean; error?: string }>;
      stopStreamingTranscription: () => Promise<{
        success: boolean;
        error?: string;
      }>;
      getWhisperSettings: () => Promise<any>;
      getStreamingTranscriptionInfo: () => Promise<any>;
      getSupportedSttProviders: () => Promise<string[]>;
      getSttProviderInfo: (providerType: string) => Promise<any>;
      getSttProviderStatus: () => Promise<any[]>;
      initializeSttProvider: (providerType: string) => Promise<{ success: boolean; error?: string }>;
      switchSttProvider: (providerType: string) => Promise<{ success: boolean; error?: string }>;
      startSttStreaming: (options: any) => Promise<{ success: boolean; error?: string }>;
      stopSttStreaming: () => Promise<{ success: boolean; error?: string }>;
      getCurrentSttProvider: () => Promise<string | null>;
      updateSttConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
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

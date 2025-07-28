import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスで使用するAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
  // 音声関連
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startAudioCapture: (deviceId: string) =>
    ipcRenderer.invoke('start-audio-capture', deviceId),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  getAudioLevel: () => ipcRenderer.invoke('get-audio-level'),
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
  startMicrophoneCapture: (micDevice?: string) =>
    ipcRenderer.invoke('start-microphone-capture', micDevice),

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
  getSttStreamingStatus: () => ipcRenderer.invoke('get-stt-streaming-status'),
  getCurrentSttProvider: () => ipcRenderer.invoke('get-current-stt-provider'),
  updateSttConfig: (config: any) => ipcRenderer.invoke('update-stt-config', config),

  // STTサービス関連
  initializeSttService: () => ipcRenderer.invoke('initialize-stt-service'),
  getSttServiceStatus: () => ipcRenderer.invoke('get-stt-service-status'),
  getSttProfiles: () => ipcRenderer.invoke('get-stt-profiles'),
  getCurrentSttProfile: () => ipcRenderer.invoke('get-current-stt-profile'),
  switchSttProfile: (profileId: string) => ipcRenderer.invoke('switch-stt-profile', profileId),
  createSttProfile: (name: string, engineConfig: any, defaultOptions: any, description?: string) => ipcRenderer.invoke('create-stt-profile', name, engineConfig, defaultOptions, description),
  updateSttProfile: (id: string, updates: any) => ipcRenderer.invoke('update-stt-profile', id, updates),
  deleteSttProfile: (id: string) => ipcRenderer.invoke('delete-stt-profile', id),
  getSttErrorStats: () => ipcRenderer.invoke('get-stt-error-stats'),
  getRecentSttErrors: (count: number) => ipcRenderer.invoke('get-recent-stt-errors', count),
  resolveSttError: (errorId: string) => ipcRenderer.invoke('resolve-stt-error', errorId),
  clearSttErrors: () => ipcRenderer.invoke('clear-stt-errors'),
  saveSttConfig: () => ipcRenderer.invoke('save-stt-config'),
  reloadSttConfig: () => ipcRenderer.invoke('reload-stt-config'),
  resetSttConfig: () => ipcRenderer.invoke('reset-stt-config'),
  exportSttProfile: (id: string) => ipcRenderer.invoke('export-stt-profile', id),
  importSttProfile: (profileData: string) => ipcRenderer.invoke('import-stt-profile', profileData),

  // トランスクリプト集約関連
  getTranscriptAggregatorInfo: () => ipcRenderer.invoke('get-transcript-aggregator-info'),
  updateTranscriptAggregatorConfig: (config: any) => ipcRenderer.invoke('update-transcript-aggregator-config', config),
  getAggregatedTranscripts: () => ipcRenderer.invoke('get-aggregated-transcripts'),

  // ファイル関連
  saveFile: (data: any, filename: string) =>
    ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),

  // 設定関連
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) =>
    ipcRenderer.invoke('save-settings', settings),

  // LLM設定管理
  getLLMSettings: () => ipcRenderer.invoke('llm-settings:get-settings'),
  updateLLMSettings: (settings: any) => ipcRenderer.invoke('llm-settings:update-settings', settings),
  setDefaultLLMProvider: (provider: string) => ipcRenderer.invoke('llm-settings:set-default-provider', provider),
  getLLMApiKeys: () => ipcRenderer.invoke('llm-settings:get-api-keys'),
  setLLMApiKey: (provider: string, key: string) => ipcRenderer.invoke('llm-settings:set-api-key', provider, key),
  removeLLMApiKey: (provider: string) => ipcRenderer.invoke('llm-settings:remove-api-key', provider),
  getLLMLocalModels: () => ipcRenderer.invoke('llm-settings:get-local-models'),
  addLLMLocalModel: (modelInfo: any) => ipcRenderer.invoke('llm-settings:add-local-model', modelInfo),
  removeLLMLocalModel: (id: string) => ipcRenderer.invoke('llm-settings:remove-local-model', id),
  downloadLLMModel: (id: string) => ipcRenderer.invoke('llm-settings:download-model', id),
  getLLMCostHistory: (days: number) => ipcRenderer.invoke('llm-settings:get-cost-history', days),
  getLLMCostLimits: () => ipcRenderer.invoke('llm-settings:get-cost-limits'),
  setLLMCostLimits: (limits: any) => ipcRenderer.invoke('llm-settings:set-cost-limits', limits),

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
  onTranscriptSegmentAdded: (callback: (data: any) => void) => {
    ipcRenderer.on('transcript-segment-added', (_, data) => callback(data));
  },
  onTranscriptBatchProcessed: (callback: (data: any) => void) => {
    ipcRenderer.on('transcript-batch-processed', (_, data) => callback(data));
  },
  onTranscriptSessionStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('transcript-session-started', (_, data) => callback(data));
  },
  onTranscriptSessionStopped: (callback: (data: any) => void) => {
    ipcRenderer.on('transcript-session-stopped', (_, data) => callback(data));
  },
  
  // STTストリーミング状態イベント
  onSttStreamingStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('stt-streaming-status', (_, data) => callback(data));
  },
  onSttError: (callback: (error: any) => void) => {
    ipcRenderer.on('stt-error', (_, error) => callback(error));
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
      getAudioLevel: () => Promise<any>;
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
      startMicrophoneCapture: (micDevice?: string) => Promise<{ success: boolean; error?: string }>;
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
      getSttStreamingStatus: () => Promise<any>;
      getCurrentSttProvider: () => Promise<string | null>;
      updateSttConfig: (config: any) => Promise<{ success: boolean; error?: string }>;

      // STTサービス関連
      initializeSttService: () => Promise<{ success: boolean; error?: string }>;
      getSttServiceStatus: () => Promise<any>;
      getSttProfiles: () => Promise<any[]>;
      getCurrentSttProfile: () => Promise<any>;
      switchSttProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
      createSttProfile: (name: string, engineConfig: any, defaultOptions: any, description?: string) => Promise<{ success: boolean; profileId?: string; error?: string }>;
      updateSttProfile: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
      deleteSttProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
      getSttErrorStats: () => Promise<any>;
      getRecentSttErrors: (count: number) => Promise<any[]>;
      resolveSttError: (errorId: string) => Promise<{ success: boolean; error?: string }>;
      clearSttErrors: () => Promise<{ success: boolean; error?: string }>;
      saveSttConfig: () => Promise<{ success: boolean; error?: string }>;
      reloadSttConfig: () => Promise<{ success: boolean; error?: string }>;
      resetSttConfig: () => Promise<{ success: boolean; error?: string }>;
      exportSttProfile: (id: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      importSttProfile: (profileData: string) => Promise<{ success: boolean; profileId?: string; error?: string }>;
      getTranscriptAggregatorInfo: () => Promise<any>;
      updateTranscriptAggregatorConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
      getAggregatedTranscripts: () => Promise<any[]>;
      saveFile: (data: any, filename: string) => Promise<void>;
      openFile: () => Promise<any>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      onAudioData: (callback: (data: any) => void) => void;
      onTranscriptionUpdate: (callback: (data: any) => void) => void;
      onSummaryUpdate: (callback: (data: any) => void) => void;
      onTranscriptSegmentAdded: (callback: (data: any) => void) => void;
      onTranscriptBatchProcessed: (callback: (data: any) => void) => void;
      onTranscriptSessionStarted: (callback: (data: any) => void) => void;
      onTranscriptSessionStopped: (callback: (data: any) => void) => void;
      onSttStreamingStatus: (callback: (data: any) => void) => void;
      onSttError: (callback: (error: any) => void) => void;
    };
  }
}

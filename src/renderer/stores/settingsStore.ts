import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface STTSettings {
  engine: 'whisper' | 'assemblyai' | 'deepgram' | 'google';
  model: string;
  language: string;
  enableRealTime: boolean;
  confidenceThreshold: number;
  enableSpeakerDiarization: boolean;
  maxSpeakers: number;
}

export interface LLMSettings {
  provider: 'openai' | 'gemini' | 'llama';
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
  autoSummarize: boolean;
  summarizeInterval: number; // seconds
}

export interface AudioSettings {
  inputDevice: string;
  outputDevice: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  enableVirtualDevice: boolean;
  enableNoiseReduction: boolean;
  enableEchoCancellation: boolean;
  volumeThreshold: number;
}

export interface UISettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  fontSize: 'small' | 'medium' | 'large';
  enableAnimations: boolean;
  enableNotifications: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // minutes
}

export interface ExportSettings {
  defaultFormat: 'text' | 'json' | 'markdown' | 'srt';
  includeTimestamps: boolean;
  includeConfidence: boolean;
  includeSpeakerInfo: boolean;
  autoExport: boolean;
  exportPath: string;
}

export interface SettingsState {
  // 各設定カテゴリ
  stt: STTSettings;
  llm: LLMSettings;
  audio: AudioSettings;
  ui: UISettings;
  export: ExportSettings;
  
  // 設定状態
  isLoaded: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: number | null;
  
  // エラー状態
  error: string | null;
}

export interface SettingsActions {
  // STT設定
  updateSTTSettings: (settings: Partial<STTSettings>) => void;
  resetSTTSettings: () => void;
  
  // LLM設定
  updateLLMSettings: (settings: Partial<LLMSettings>) => void;
  resetLLMSettings: () => void;
  setAPIKey: (provider: string, apiKey: string) => void;
  
  // 音声設定
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  resetAudioSettings: () => void;
  
  // UI設定
  updateUISettings: (settings: Partial<UISettings>) => void;
  resetUISettings: () => void;
  
  // エクスポート設定
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  resetExportSettings: () => void;
  
  // 全般設定
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  resetAllSettings: () => void;
  
  // 状態管理
  setLoaded: (loaded: boolean) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  setLastSaved: (timestamp: number) => void;
  
  // エラー処理
  setError: (error: string | null) => void;
  
  // ユーティリティ
  validateSettings: () => { isValid: boolean; errors: string[] };
  exportSettings: () => string;
  importSettings: (settingsJson: string) => boolean;
}

const defaultSTTSettings: STTSettings = {
  engine: 'whisper',
  model: 'base',
  language: 'ja',
  enableRealTime: true,
  confidenceThreshold: 0.8,
  enableSpeakerDiarization: true,
  maxSpeakers: 4,
};

const defaultLLMSettings: LLMSettings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 1000,
  enableStreaming: true,
  autoSummarize: true,
  summarizeInterval: 15,
};

const defaultAudioSettings: AudioSettings = {
  inputDevice: '',
  outputDevice: '',
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  enableVirtualDevice: false,
  enableNoiseReduction: true,
  enableEchoCancellation: true,
  volumeThreshold: 0.1,
};

const defaultUISettings: UISettings = {
  theme: 'auto',
  language: 'ja',
  fontSize: 'medium',
  enableAnimations: true,
  enableNotifications: true,
  autoSave: true,
  autoSaveInterval: 5,
};

const defaultExportSettings: ExportSettings = {
  defaultFormat: 'markdown',
  includeTimestamps: true,
  includeConfidence: false,
  includeSpeakerInfo: true,
  autoExport: false,
  exportPath: '',
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      // 初期状態
      stt: defaultSTTSettings,
      llm: defaultLLMSettings,
      audio: defaultAudioSettings,
      ui: defaultUISettings,
      export: defaultExportSettings,
      isLoaded: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      error: null,

      // STT設定
      updateSTTSettings: (settings) => set((state) => ({
        stt: { ...state.stt, ...settings },
        hasUnsavedChanges: true,
      })),
      
      resetSTTSettings: () => set((state) => ({
        stt: defaultSTTSettings,
        hasUnsavedChanges: true,
      })),

      // LLM設定
      updateLLMSettings: (settings) => set((state) => ({
        llm: { ...state.llm, ...settings },
        hasUnsavedChanges: true,
      })),
      
      resetLLMSettings: () => set((state) => ({
        llm: defaultLLMSettings,
        hasUnsavedChanges: true,
      })),
      
      setAPIKey: (provider, apiKey) => set((state) => ({
        llm: { ...state.llm, apiKey },
        hasUnsavedChanges: true,
      })),

      // 音声設定
      updateAudioSettings: (settings) => set((state) => ({
        audio: { ...state.audio, ...settings },
        hasUnsavedChanges: true,
      })),
      
      resetAudioSettings: () => set((state) => ({
        audio: defaultAudioSettings,
        hasUnsavedChanges: true,
      })),

      // UI設定
      updateUISettings: (settings) => set((state) => ({
        ui: { ...state.ui, ...settings },
        hasUnsavedChanges: true,
      })),
      
      resetUISettings: () => set((state) => ({
        ui: defaultUISettings,
        hasUnsavedChanges: true,
      })),

      // エクスポート設定
      updateExportSettings: (settings) => set((state) => ({
        export: { ...state.export, ...settings },
        hasUnsavedChanges: true,
      })),
      
      resetExportSettings: () => set((state) => ({
        export: defaultExportSettings,
        hasUnsavedChanges: true,
      })),

      // 全般設定
      loadSettings: async () => {
        try {
          // 実際の実装ではローカルストレージやファイルから読み込み
          set({ isLoaded: true, error: null });
        } catch (error) {
          set({ error: `設定の読み込みに失敗しました: ${error}` });
        }
      },
      
      saveSettings: async () => {
        try {
          const timestamp = Date.now();
          set({ 
            hasUnsavedChanges: false, 
            lastSaved: timestamp,
            error: null 
          });
        } catch (error) {
          set({ error: `設定の保存に失敗しました: ${error}` });
        }
      },
      
      resetAllSettings: () => set({
        stt: defaultSTTSettings,
        llm: defaultLLMSettings,
        audio: defaultAudioSettings,
        ui: defaultUISettings,
        export: defaultExportSettings,
        hasUnsavedChanges: true,
      }),

      // 状態管理
      setLoaded: (loaded) => set({ isLoaded: loaded }),
      
      setUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
      
      setLastSaved: (timestamp) => set({ lastSaved: timestamp }),

      // エラー処理
      setError: (error) => set({ error }),

      // ユーティリティ
      validateSettings: () => {
        const state = get();
        const errors: string[] = [];
        
        // LLM設定の検証
        if (state.llm.provider === 'openai' && !state.llm.apiKey) {
          errors.push('OpenAI APIキーが設定されていません');
        }
        
        // 音声設定の検証
        if (!state.audio.inputDevice) {
          errors.push('入力デバイスが選択されていません');
        }
        
        // STT設定の検証
        if (state.stt.confidenceThreshold < 0 || state.stt.confidenceThreshold > 1) {
          errors.push('信頼度閾値は0から1の間である必要があります');
        }
        
        return {
          isValid: errors.length === 0,
          errors,
        };
      },
      
      exportSettings: () => {
        const state = get();
        const { isLoaded, hasUnsavedChanges, lastSaved, error, ...settings } = state;
        return JSON.stringify(settings, null, 2);
      },
      
      importSettings: (settingsJson) => {
        try {
          const settings = JSON.parse(settingsJson);
          set({
            stt: settings.stt || defaultSTTSettings,
            llm: settings.llm || defaultLLMSettings,
            audio: settings.audio || defaultAudioSettings,
            ui: settings.ui || defaultUISettings,
            export: settings.export || defaultExportSettings,
            hasUnsavedChanges: true,
          });
          return true;
        } catch (error) {
          set({ error: `設定のインポートに失敗しました: ${error}` });
          return false;
        }
      },
    }),
    {
      name: 'voice-summary-settings',
      partialize: (state) => ({
        stt: state.stt,
        llm: { ...state.llm, apiKey: '' }, // APIキーは保存しない
        audio: state.audio,
        ui: state.ui,
        export: state.export,
      }),
    }
  )
); 

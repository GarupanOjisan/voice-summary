import { create } from 'zustand';

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output' | 'virtual';
  isDefault: boolean;
  sampleRate: number;
  channels: number;
}

export interface AudioLevel {
  current: number;
  peak: number;
  average: number;
}

export interface AudioState {
  // デバイス情報
  devices: AudioDevice[];
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  virtualDeviceEnabled: boolean;
  
  // 録音状態
  isRecording: boolean;
  isPaused: boolean;
  recordingStartTime: number | null;
  recordingDuration: number;
  
  // 音声レベル
  audioLevel: AudioLevel;
  isAudioDetected: boolean;
  
  // 音声品質
  sampleRate: number;
  bitDepth: number;
  channels: number;
  
  // エラー状態
  error: string | null;
  isInitialized: boolean;
}

export interface AudioActions {
  // デバイス管理
  setDevices: (devices: AudioDevice[]) => void;
  setSelectedInputDevice: (deviceId: string) => void;
  setSelectedOutputDevice: (deviceId: string) => void;
  setVirtualDeviceEnabled: (enabled: boolean) => void;
  
  // 録音制御
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  
  // 音声レベル更新
  updateAudioLevel: (level: AudioLevel) => void;
  setAudioDetected: (detected: boolean) => void;
  
  // 音声品質設定
  setSampleRate: (rate: number) => void;
  setBitDepth: (depth: number) => void;
  setChannels: (channels: number) => void;
  
  // エラー処理
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  
  // ユーティリティ
  getFormattedDuration: () => string;
  getCurrentDevice: () => AudioDevice | null;
}

export const useAudioStore = create<AudioState & AudioActions>((set, get) => ({
  // 初期状態
  devices: [],
  selectedInputDevice: null,
  selectedOutputDevice: null,
  virtualDeviceEnabled: false,
  isRecording: false,
  isPaused: false,
  recordingStartTime: null,
  recordingDuration: 0,
  audioLevel: { current: 0, peak: 0, average: 0 },
  isAudioDetected: false,
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  error: null,
  isInitialized: false,

  // デバイス管理
  setDevices: (devices) => set({ devices }),
  
  setSelectedInputDevice: (deviceId) => set({ selectedInputDevice: deviceId }),
  
  setSelectedOutputDevice: (deviceId) => set({ selectedOutputDevice: deviceId }),
  
  setVirtualDeviceEnabled: (enabled) => set({ virtualDeviceEnabled: enabled }),

  // 録音制御
  startRecording: () => set((state) => ({
    isRecording: true,
    isPaused: false,
    recordingStartTime: Date.now(),
    recordingDuration: 0,
    error: null,
  })),
  
  stopRecording: () => set((state) => ({
    isRecording: false,
    isPaused: false,
    recordingStartTime: null,
    recordingDuration: 0,
  })),
  
  pauseRecording: () => set((state) => ({
    isPaused: true,
  })),
  
  resumeRecording: () => set((state) => ({
    isPaused: false,
  })),
  
  resetRecording: () => set({
    isRecording: false,
    isPaused: false,
    recordingStartTime: null,
    recordingDuration: 0,
    audioLevel: { current: 0, peak: 0, average: 0 },
    isAudioDetected: false,
  }),

  // 音声レベル更新
  updateAudioLevel: (level) => set({ audioLevel: level }),
  
  setAudioDetected: (detected) => set({ isAudioDetected: detected }),

  // 音声品質設定
  setSampleRate: (rate) => set({ sampleRate: rate }),
  
  setBitDepth: (depth) => set({ bitDepth: depth }),
  
  setChannels: (channels) => set({ channels }),

  // エラー処理
  setError: (error) => set({ error }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),

  // ユーティリティ
  getFormattedDuration: () => {
    const state = get();
    const duration = state.recordingDuration;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },
  
  getCurrentDevice: () => {
    const state = get();
    return state.devices.find(device => device.id === state.selectedInputDevice) || null;
  },
})); 

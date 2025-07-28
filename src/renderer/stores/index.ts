// 各ストアのエクスポート
export { useAudioStore } from './audioStore';
export { useTranscriptionStore } from './transcriptionStore';
export { useSummaryStore } from './summaryStore';
export { useSettingsStore } from './settingsStore';
export { useErrorStore } from './errorStore';

// 型定義のエクスポート
export type {
  AudioDevice,
  AudioLevel,
  AudioState,
  AudioActions,
} from './audioStore';

export type {
  TranscriptSegment,
  Speaker,
  TranscriptionState,
  TranscriptionActions,
} from './transcriptionStore';

export type {
  Summary,
  Topic,
  Highlight,
  ActionItem,
  SummaryState,
  SummaryActions,
} from './summaryStore';

export type {
  STTSettings,
  LLMSettings,
  AudioSettings,
  UISettings,
  ExportSettings,
  SettingsState,
  SettingsActions,
} from './settingsStore';

export type {
  ErrorItem,
  ErrorState,
  ErrorActions,
} from './errorStore';

// 統合されたアプリケーション状態の型定義
export interface AppState {
  audio: ReturnType<typeof import('./audioStore').useAudioStore>;
  transcription: ReturnType<typeof import('./transcriptionStore').useTranscriptionStore>;
  summary: ReturnType<typeof import('./summaryStore').useSummaryStore>;
  settings: ReturnType<typeof import('./settingsStore').useSettingsStore>;
  error: ReturnType<typeof import('./errorStore').useErrorStore>;
}

// ストアの初期化とリセット用のユーティリティ
export const resetAllStores = () => {
  const { useAudioStore } = require('./audioStore');
  const { useTranscriptionStore } = require('./transcriptionStore');
  const { useSummaryStore } = require('./summaryStore');
  const { useSettingsStore } = require('./settingsStore');
  const { useErrorStore } = require('./errorStore');

  useAudioStore.getState().resetRecording();
  useTranscriptionStore.getState().clearSegments();
  useSummaryStore.getState().clearSummaries();
  useSettingsStore.getState().resetAllSettings();
  useErrorStore.getState().clearErrors();
};

// ストアの状態をエクスポートするユーティリティ
export const exportAppState = () => {
  const { useAudioStore } = require('./audioStore');
  const { useTranscriptionStore } = require('./transcriptionStore');
  const { useSummaryStore } = require('./summaryStore');
  const { useSettingsStore } = require('./settingsStore');
  const { useErrorStore } = require('./errorStore');

  return {
    audio: useAudioStore.getState(),
    transcription: useTranscriptionStore.getState(),
    summary: useSummaryStore.getState(),
    settings: useSettingsStore.getState(),
    error: useErrorStore.getState(),
  };
};

// ストアの状態をインポートするユーティリティ
export const importAppState = (state: any) => {
  const { useAudioStore } = require('./audioStore');
  const { useTranscriptionStore } = require('./transcriptionStore');
  const { useSummaryStore } = require('./summaryStore');
  const { useSettingsStore } = require('./settingsStore');
  const { useErrorStore } = require('./errorStore');

  if (state.audio) {
    // 音声状態の復元（必要な部分のみ）
    const audioState = useAudioStore.getState();
    if (state.audio.devices) audioState.setDevices(state.audio.devices);
    if (state.audio.selectedInputDevice) audioState.setSelectedInputDevice(state.audio.selectedInputDevice);
    if (state.audio.selectedOutputDevice) audioState.setSelectedOutputDevice(state.audio.selectedOutputDevice);
  }

  if (state.transcription) {
    // 文字起こし状態の復元
    const transcriptionState = useTranscriptionStore.getState();
    if (state.transcription.segments) {
      state.transcription.segments.forEach((segment: any) => {
        transcriptionState.addSegment(segment);
      });
    }
    if (state.transcription.speakers) {
      state.transcription.speakers.forEach((speaker: any) => {
        transcriptionState.addSpeaker(speaker);
      });
    }
  }

  if (state.summary) {
    // 要約状態の復元
    const summaryState = useSummaryStore.getState();
    if (state.summary.summaries) {
      state.summary.summaries.forEach((summary: any) => {
        summaryState.addSummary(summary);
      });
    }
    if (state.summary.topics) {
      state.summary.topics.forEach((topic: any) => {
        summaryState.addTopic(topic);
      });
    }
    if (state.summary.highlights) {
      state.summary.highlights.forEach((highlight: any) => {
        summaryState.addHighlight(highlight);
      });
    }
    if (state.summary.actionItems) {
      state.summary.actionItems.forEach((actionItem: any) => {
        summaryState.addActionItem(actionItem);
      });
    }
  }

  if (state.settings) {
    // 設定状態の復元
    const settingsState = useSettingsStore.getState();
    if (state.settings.stt) settingsState.updateSTTSettings(state.settings.stt);
    if (state.settings.llm) settingsState.updateLLMSettings(state.settings.llm);
    if (state.settings.audio) settingsState.updateAudioSettings(state.settings.audio);
    if (state.settings.ui) settingsState.updateUISettings(state.settings.ui);
    if (state.settings.export) settingsState.updateExportSettings(state.settings.export);
  }

  if (state.error) {
    // エラー状態の復元
    const errorState = useErrorStore.getState();
    if (state.error.errors) {
      state.error.errors.forEach((error: any) => {
        errorState.addError(error);
      });
    }
  }
}; 

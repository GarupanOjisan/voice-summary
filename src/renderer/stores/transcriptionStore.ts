import { create } from 'zustand';

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isFinal: boolean;
  timestamp: string;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface TranscriptionState {
  // 文字起こしデータ
  segments: TranscriptSegment[];
  currentSegment: TranscriptSegment | null;
  aggregatedText: string;
  
  // 話者情報
  speakers: Speaker[];
  currentSpeaker: string | null;
  
  // STTエンジン状態
  sttEngine: 'whisper' | 'assemblyai' | 'deepgram' | 'google' | null;
  isSTTActive: boolean;
  sttConfidence: number;
  
  // 処理状態
  isProcessing: boolean;
  processingQueue: number;
  lastUpdateTime: number | null;
  
  // 統計情報
  totalWords: number;
  totalDuration: number;
  averageConfidence: number;
  
  // エラー状態
  error: string | null;
  retryCount: number;
}

export interface TranscriptionActions {
  // セグメント管理
  addSegment: (segment: TranscriptSegment) => void;
  updateSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
  removeSegment: (id: string) => void;
  clearSegments: () => void;
  
  // 現在のセグメント
  setCurrentSegment: (segment: TranscriptSegment | null) => void;
  updateCurrentSegment: (text: string, confidence?: number) => void;
  
  // テキスト集約
  updateAggregatedText: (text: string) => void;
  appendToAggregatedText: (text: string) => void;
  
  // 話者管理
  addSpeaker: (speaker: Speaker) => void;
  updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
  removeSpeaker: (id: string) => void;
  setCurrentSpeaker: (speakerId: string | null) => void;
  
  // STTエンジン制御
  setSTTEngine: (engine: TranscriptionState['sttEngine']) => void;
  setSTTActive: (active: boolean) => void;
  setSTTConfidence: (confidence: number) => void;
  
  // 処理状態
  setProcessing: (processing: boolean) => void;
  setProcessingQueue: (count: number) => void;
  setLastUpdateTime: (time: number) => void;
  
  // 統計更新
  updateStatistics: () => void;
  
  // エラー処理
  setError: (error: string | null) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  
  // ユーティリティ
  getSegmentsByTimeRange: (startTime: number, endTime: number) => TranscriptSegment[];
  getSegmentsBySpeaker: (speakerId: string) => TranscriptSegment[];
  getFormattedDuration: () => string;
  exportTranscript: (format: 'text' | 'json' | 'srt') => string;
}

export const useTranscriptionStore = create<TranscriptionState & TranscriptionActions>((set, get) => ({
  // 初期状態
  segments: [],
  currentSegment: null,
  aggregatedText: '',
  speakers: [],
  currentSpeaker: null,
  sttEngine: null,
  isSTTActive: false,
  sttConfidence: 0,
  isProcessing: false,
  processingQueue: 0,
  lastUpdateTime: null,
  totalWords: 0,
  totalDuration: 0,
  averageConfidence: 0,
  error: null,
  retryCount: 0,

  // セグメント管理
  addSegment: (segment) => set((state) => {
    console.log('🎯 transcriptionStore: セグメント追加', {
      newSegment: { id: segment.id.slice(-8), text: segment.text.slice(0, 20) + '...' },
      currentSegmentsCount: state.segments.length,
      willBeFirst: true
    });
    return {
      segments: [segment, ...state.segments], // 新しいセグメントを先頭に追加
      lastUpdateTime: Date.now(),
    };
  }),
  
  updateSegment: (id, updates) => set((state) => ({
    segments: state.segments.map(segment =>
      segment.id === id ? { ...segment, ...updates } : segment
    ),
  })),
  
  removeSegment: (id) => set((state) => ({
    segments: state.segments.filter(segment => segment.id !== id),
  })),
  
  clearSegments: () => set({
    segments: [],
    currentSegment: null,
    aggregatedText: '',
    totalWords: 0,
    totalDuration: 0,
    averageConfidence: 0,
  }),

  // 現在のセグメント
  setCurrentSegment: (segment) => set({ currentSegment: segment }),
  
  updateCurrentSegment: (text, confidence) => set((state) => ({
    currentSegment: state.currentSegment
      ? { ...state.currentSegment, text, confidence: confidence || state.currentSegment.confidence }
      : null,
  })),

  // テキスト集約
  updateAggregatedText: (text) => set({ aggregatedText: text }),
  
  appendToAggregatedText: (text) => set((state) => ({
    aggregatedText: state.aggregatedText + text,
  })),

  // 話者管理
  addSpeaker: (speaker) => set((state) => ({
    speakers: [...state.speakers, speaker],
  })),
  
  updateSpeaker: (id, updates) => set((state) => ({
    speakers: state.speakers.map(speaker =>
      speaker.id === id ? { ...speaker, ...updates } : speaker
    ),
  })),
  
  removeSpeaker: (id) => set((state) => ({
    speakers: state.speakers.filter(speaker => speaker.id !== id),
  })),
  
  setCurrentSpeaker: (speakerId) => set({ currentSpeaker: speakerId }),

  // STTエンジン制御
  setSTTEngine: (engine) => set({ sttEngine: engine }),
  
  setSTTActive: (active) => set({ isSTTActive: active }),
  
  setSTTConfidence: (confidence) => set({ sttConfidence: confidence }),

  // 処理状態
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setProcessingQueue: (count) => set({ processingQueue: count }),
  
  setLastUpdateTime: (time) => set({ lastUpdateTime: time }),

  // 統計更新
  updateStatistics: () => set((state) => {
    const totalWords = state.segments.reduce((sum, segment) => 
      sum + segment.text.split(' ').length, 0
    );
    
    const totalDuration = state.segments.length > 0
      ? Math.max(...state.segments.map(s => s.endTime)) - Math.min(...state.segments.map(s => s.startTime))
      : 0;
    
    const averageConfidence = state.segments.length > 0
      ? state.segments.reduce((sum, segment) => sum + segment.confidence, 0) / state.segments.length
      : 0;
    
    return { totalWords, totalDuration, averageConfidence };
  }),

  // エラー処理
  setError: (error) => set({ error }),
  
  incrementRetryCount: () => set((state) => ({ retryCount: state.retryCount + 1 })),
  
  resetRetryCount: () => set({ retryCount: 0 }),

  // ユーティリティ
  getSegmentsByTimeRange: (startTime, endTime) => {
    const state = get();
    return state.segments.filter(segment =>
      segment.startTime >= startTime && segment.endTime <= endTime
    );
  },
  
  getSegmentsBySpeaker: (speakerId) => {
    const state = get();
    return state.segments.filter(segment => segment.speaker === speakerId);
  },
  
  getFormattedDuration: () => {
    const state = get();
    const duration = state.totalDuration;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },
  
  exportTranscript: (format) => {
    const state = get();
    
    switch (format) {
      case 'text':
        return state.segments.map(segment => 
          `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`
        ).join('\n');
      
      case 'json':
        return JSON.stringify(state.segments, null, 2);
      
      case 'srt':
        return state.segments.map((segment, index) => 
          `${index + 1}\n${segment.timestamp} --> ${segment.timestamp}\n${segment.speaker}: ${segment.text}\n`
        ).join('\n');
      
      default:
        return '';
    }
  },
})); 

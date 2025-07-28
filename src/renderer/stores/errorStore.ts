import { create } from 'zustand';

export interface ErrorItem {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  details?: string;
  timestamp: number;
  source: 'audio' | 'stt' | 'llm' | 'ui' | 'system';
  isResolved: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorState {
  // エラーリスト
  errors: ErrorItem[];
  activeErrors: string[];
  
  // エラー統計
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  
  // エラー設定
  maxErrors: number;
  autoDismiss: boolean;
  autoDismissDelay: number; // milliseconds
  enableNotifications: boolean;
  
  // エラー処理状態
  isProcessing: boolean;
  lastErrorTime: number | null;
}

export interface ErrorActions {
  // エラー管理
  addError: (error: Omit<ErrorItem, 'id' | 'timestamp' | 'isResolved' | 'retryCount'>) => void;
  updateError: (id: string, updates: Partial<ErrorItem>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  clearErrorsByType: (type: ErrorItem['type']) => void;
  clearErrorsBySource: (source: ErrorItem['source']) => void;
  
  // エラー解決
  resolveError: (id: string) => void;
  resolveAllErrors: () => void;
  retryError: (id: string) => void;
  
  // アクティブエラー管理
  setActiveErrors: (errorIds: string[]) => void;
  addActiveError: (errorId: string) => void;
  removeActiveError: (errorId: string) => void;
  
  // 統計更新
  updateStatistics: () => void;
  
  // 設定管理
  setMaxErrors: (max: number) => void;
  setAutoDismiss: (enabled: boolean) => void;
  setAutoDismissDelay: (delay: number) => void;
  setEnableNotifications: (enabled: boolean) => void;
  
  // 処理状態
  setProcessing: (processing: boolean) => void;
  setLastErrorTime: (time: number) => void;
  
  // ユーティリティ
  getErrorsByType: (type: ErrorItem['type']) => ErrorItem[];
  getErrorsBySource: (source: ErrorItem['source']) => ErrorItem[];
  getUnresolvedErrors: () => ErrorItem[];
  getRetryableErrors: () => ErrorItem[];
  hasCriticalErrors: () => boolean;
  exportErrorLog: (format: 'json' | 'text') => string;
}

export const useErrorStore = create<ErrorState & ErrorActions>((set, get) => ({
  // 初期状態
  errors: [],
  activeErrors: [],
  totalErrors: 0,
  totalWarnings: 0,
  totalInfo: 0,
  maxErrors: 100,
  autoDismiss: true,
  autoDismissDelay: 5000,
  enableNotifications: true,
  isProcessing: false,
  lastErrorTime: null,

  // エラー管理
  addError: (error) => set((state) => {
    const newError: ErrorItem = {
      ...error,
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      isResolved: false,
      retryCount: 0,
    };
    
    const updatedErrors = [...state.errors, newError];
    
    // 最大エラー数を超えた場合、古いエラーを削除
    if (updatedErrors.length > state.maxErrors) {
      updatedErrors.splice(0, updatedErrors.length - state.maxErrors);
    }
    
    return {
      errors: updatedErrors,
      lastErrorTime: Date.now(),
    };
  }),
  
  updateError: (id, updates) => set((state) => ({
    errors: state.errors.map(error =>
      error.id === id ? { ...error, ...updates } : error
    ),
  })),
  
  removeError: (id) => set((state) => ({
    errors: state.errors.filter(error => error.id !== id),
    activeErrors: state.activeErrors.filter(errorId => errorId !== id),
  })),
  
  clearErrors: () => set({
    errors: [],
    activeErrors: [],
    totalErrors: 0,
    totalWarnings: 0,
    totalInfo: 0,
  }),
  
  clearErrorsByType: (type) => set((state) => ({
    errors: state.errors.filter(error => error.type !== type),
    activeErrors: state.activeErrors.filter(errorId => 
      !state.errors.find(error => error.id === errorId && error.type === type)
    ),
  })),
  
  clearErrorsBySource: (source) => set((state) => ({
    errors: state.errors.filter(error => error.source !== source),
    activeErrors: state.activeErrors.filter(errorId => 
      !state.errors.find(error => error.id === errorId && error.source === source)
    ),
  })),

  // エラー解決
  resolveError: (id) => set((state) => ({
    errors: state.errors.map(error =>
      error.id === id ? { ...error, isResolved: true } : error
    ),
    activeErrors: state.activeErrors.filter(errorId => errorId !== id),
  })),
  
  resolveAllErrors: () => set((state) => ({
    errors: state.errors.map(error => ({ ...error, isResolved: true })),
    activeErrors: [],
  })),
  
  retryError: (id) => set((state) => ({
    errors: state.errors.map(error =>
      error.id === id && error.retryCount < error.maxRetries
        ? { ...error, retryCount: error.retryCount + 1, isResolved: false }
        : error
    ),
  })),

  // アクティブエラー管理
  setActiveErrors: (errorIds) => set({ activeErrors: errorIds }),
  
  addActiveError: (errorId) => set((state) => ({
    activeErrors: state.activeErrors.includes(errorId)
      ? state.activeErrors
      : [...state.activeErrors, errorId],
  })),
  
  removeActiveError: (errorId) => set((state) => ({
    activeErrors: state.activeErrors.filter(id => id !== errorId),
  })),

  // 統計更新
  updateStatistics: () => set((state) => {
    const totalErrors = state.errors.filter(error => error.type === 'error').length;
    const totalWarnings = state.errors.filter(error => error.type === 'warning').length;
    const totalInfo = state.errors.filter(error => error.type === 'info').length;
    
    return { totalErrors, totalWarnings, totalInfo };
  }),

  // 設定管理
  setMaxErrors: (max) => set({ maxErrors: max }),
  
  setAutoDismiss: (enabled) => set({ autoDismiss: enabled }),
  
  setAutoDismissDelay: (delay) => set({ autoDismissDelay: delay }),
  
  setEnableNotifications: (enabled) => set({ enableNotifications: enabled }),

  // 処理状態
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setLastErrorTime: (time) => set({ lastErrorTime: time }),

  // ユーティリティ
  getErrorsByType: (type) => {
    const state = get();
    return state.errors.filter(error => error.type === type);
  },
  
  getErrorsBySource: (source) => {
    const state = get();
    return state.errors.filter(error => error.source === source);
  },
  
  getUnresolvedErrors: () => {
    const state = get();
    return state.errors.filter(error => !error.isResolved);
  },
  
  getRetryableErrors: () => {
    const state = get();
    return state.errors.filter(error => 
      !error.isResolved && error.retryCount < error.maxRetries
    );
  },
  
  hasCriticalErrors: () => {
    const state = get();
    return state.errors.some(error => 
      error.type === 'error' && !error.isResolved
    );
  },
  
  exportErrorLog: (format) => {
    const state = get();
    
    switch (format) {
      case 'json':
        return JSON.stringify(state.errors, null, 2);
      
      case 'text':
        return state.errors.map(error => 
          `[${new Date(error.timestamp).toISOString()}] ${error.type.toUpperCase()}: ${error.title}\n${error.message}\n${error.details || ''}\n`
        ).join('\n');
      
      default:
        return '';
    }
  },
})); 

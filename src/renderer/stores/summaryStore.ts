import { create } from 'zustand';

export interface Summary {
  id: string;
  type: 'discussion' | 'topics' | 'highlights' | 'action_items';
  content: string;
  timestamp: string;
  confidence: number;
  wordCount: number;
  processingTime: number;
  model: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  confidence: number;
  startTime: number;
  endTime: number;
  mentions: number;
  relatedTopics: string[];
}

export interface Highlight {
  id: string;
  text: string;
  type: 'action' | 'decision' | 'important' | 'question';
  speaker: string;
  timestamp: string;
  confidence: number;
  context: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  timestamp: string;
}

export interface SummaryState {
  // 要約データ
  summaries: Summary[];
  currentSummary: Summary | null;
  
  // トピック
  topics: Topic[];
  activeTopics: string[];
  
  // ハイライト
  highlights: Highlight[];
  highlightFilters: string[];
  
  // アクションアイテム
  actionItems: ActionItem[];
  
  // LLM設定
  selectedLLM: 'openai' | 'gemini' | 'llama' | null;
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;
  
  // 処理状態
  isGenerating: boolean;
  generationProgress: number;
  lastGenerationTime: number | null;
  
  // 統計情報
  totalSummaries: number;
  averageConfidence: number;
  totalProcessingTime: number;
  
  // エラー状態
  error: string | null;
  retryCount: number;
}

export interface SummaryActions {
  // 要約管理
  addSummary: (summary: Summary) => void;
  updateSummary: (id: string, updates: Partial<Summary>) => void;
  removeSummary: (id: string) => void;
  clearSummaries: () => void;
  setCurrentSummary: (summary: Summary | null) => void;
  
  // トピック管理
  addTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
  removeTopic: (id: string) => void;
  setActiveTopics: (topicIds: string[]) => void;
  
  // ハイライト管理
  addHighlight: (highlight: Highlight) => void;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  removeHighlight: (id: string) => void;
  setHighlightFilters: (filters: string[]) => void;
  
  // アクションアイテム管理
  addActionItem: (actionItem: ActionItem) => void;
  updateActionItem: (id: string, updates: Partial<ActionItem>) => void;
  removeActionItem: (id: string) => void;
  updateActionItemStatus: (id: string, status: ActionItem['status']) => void;
  
  // LLM設定
  setSelectedLLM: (llm: SummaryState['selectedLLM']) => void;
  setLLMModel: (model: string) => void;
  setLLMTemperature: (temperature: number) => void;
  setLLMMaxTokens: (maxTokens: number) => void;
  
  // 処理状態
  setGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setLastGenerationTime: (time: number) => void;
  
  // 統計更新
  updateStatistics: () => void;
  
  // エラー処理
  setError: (error: string | null) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  
  // ユーティリティ
  getSummariesByType: (type: Summary['type']) => Summary[];
  getTopicsByTimeRange: (startTime: number, endTime: number) => Topic[];
  getHighlightsByType: (type: Highlight['type']) => Highlight[];
  getActionItemsByStatus: (status: ActionItem['status']) => ActionItem[];
  exportSummary: (format: 'text' | 'json' | 'markdown') => string;
}

export const useSummaryStore = create<SummaryState & SummaryActions>((set, get) => ({
  // 初期状態
  summaries: [],
  currentSummary: null,
  topics: [],
  activeTopics: [],
  highlights: [],
  highlightFilters: [],
  actionItems: [],
  selectedLLM: null,
  llmModel: 'gpt-4o',
  llmTemperature: 0.7,
  llmMaxTokens: 1000,
  isGenerating: false,
  generationProgress: 0,
  lastGenerationTime: null,
  totalSummaries: 0,
  averageConfidence: 0,
  totalProcessingTime: 0,
  error: null,
  retryCount: 0,

  // 要約管理
  addSummary: (summary) => set((state) => ({
    summaries: [...state.summaries, summary],
    lastGenerationTime: Date.now(),
  })),
  
  updateSummary: (id, updates) => set((state) => ({
    summaries: state.summaries.map(summary =>
      summary.id === id ? { ...summary, ...updates } : summary
    ),
  })),
  
  removeSummary: (id) => set((state) => ({
    summaries: state.summaries.filter(summary => summary.id !== id),
  })),
  
  clearSummaries: () => set({
    summaries: [],
    currentSummary: null,
    topics: [],
    highlights: [],
    actionItems: [],
  }),
  
  setCurrentSummary: (summary) => set({ currentSummary: summary }),

  // トピック管理
  addTopic: (topic) => set((state) => ({
    topics: [...state.topics, topic],
  })),
  
  updateTopic: (id, updates) => set((state) => ({
    topics: state.topics.map(topic =>
      topic.id === id ? { ...topic, ...updates } : topic
    ),
  })),
  
  removeTopic: (id) => set((state) => ({
    topics: state.topics.filter(topic => topic.id !== id),
  })),
  
  setActiveTopics: (topicIds) => set({ activeTopics: topicIds }),

  // ハイライト管理
  addHighlight: (highlight) => set((state) => ({
    highlights: [...state.highlights, highlight],
  })),
  
  updateHighlight: (id, updates) => set((state) => ({
    highlights: state.highlights.map(highlight =>
      highlight.id === id ? { ...highlight, ...updates } : highlight
    ),
  })),
  
  removeHighlight: (id) => set((state) => ({
    highlights: state.highlights.filter(highlight => highlight.id !== id),
  })),
  
  setHighlightFilters: (filters) => set({ highlightFilters: filters }),

  // アクションアイテム管理
  addActionItem: (actionItem) => set((state) => ({
    actionItems: [...state.actionItems, actionItem],
  })),
  
  updateActionItem: (id, updates) => set((state) => ({
    actionItems: state.actionItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
  
  removeActionItem: (id) => set((state) => ({
    actionItems: state.actionItems.filter(item => item.id !== id),
  })),
  
  updateActionItemStatus: (id, status) => set((state) => ({
    actionItems: state.actionItems.map(item =>
      item.id === id ? { ...item, status } : item
    ),
  })),

  // LLM設定
  setSelectedLLM: (llm) => set({ selectedLLM: llm }),
  
  setLLMModel: (model) => set({ llmModel: model }),
  
  setLLMTemperature: (temperature) => set({ llmTemperature: temperature }),
  
  setLLMMaxTokens: (maxTokens) => set({ llmMaxTokens: maxTokens }),

  // 処理状態
  setGenerating: (generating) => set({ isGenerating: generating }),
  
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
  
  setLastGenerationTime: (time) => set({ lastGenerationTime: time }),

  // 統計更新
  updateStatistics: () => set((state) => {
    const totalSummaries = state.summaries.length;
    const averageConfidence = state.summaries.length > 0
      ? state.summaries.reduce((sum, summary) => sum + summary.confidence, 0) / state.summaries.length
      : 0;
    const totalProcessingTime = state.summaries.reduce((sum, summary) => sum + summary.processingTime, 0);
    
    return { totalSummaries, averageConfidence, totalProcessingTime };
  }),

  // エラー処理
  setError: (error) => set({ error }),
  
  incrementRetryCount: () => set((state) => ({ retryCount: state.retryCount + 1 })),
  
  resetRetryCount: () => set({ retryCount: 0 }),

  // ユーティリティ
  getSummariesByType: (type) => {
    const state = get();
    return state.summaries.filter(summary => summary.type === type);
  },
  
  getTopicsByTimeRange: (startTime, endTime) => {
    const state = get();
    return state.topics.filter(topic =>
      topic.startTime >= startTime && topic.endTime <= endTime
    );
  },
  
  getHighlightsByType: (type) => {
    const state = get();
    return state.highlights.filter(highlight => highlight.type === type);
  },
  
  getActionItemsByStatus: (status) => {
    const state = get();
    return state.actionItems.filter(item => item.status === status);
  },
  
  exportSummary: (format) => {
    const state = get();
    
    switch (format) {
      case 'text':
        return state.summaries.map(summary => 
          `[${summary.timestamp}] ${summary.type.toUpperCase()}\n${summary.content}\n`
        ).join('\n');
      
      case 'json':
        return JSON.stringify({
          summaries: state.summaries,
          topics: state.topics,
          highlights: state.highlights,
          actionItems: state.actionItems,
        }, null, 2);
      
      case 'markdown':
        let markdown = '# 会議要約\n\n';
        
        // 要約セクション
        markdown += '## 要約\n\n';
        state.summaries.forEach(summary => {
          markdown += `### ${summary.type}\n${summary.content}\n\n`;
        });
        
        // トピックセクション
        if (state.topics.length > 0) {
          markdown += '## トピック\n\n';
          state.topics.forEach(topic => {
            markdown += `- **${topic.name}**: ${topic.description}\n`;
          });
          markdown += '\n';
        }
        
        // アクションアイテムセクション
        if (state.actionItems.length > 0) {
          markdown += '## アクションアイテム\n\n';
          state.actionItems.forEach(item => {
            markdown += `- [ ] ${item.description} (担当: ${item.assignee})\n`;
          });
        }
        
        return markdown;
      
      default:
        return '';
    }
  },
})); 

import { EventEmitter } from 'events';
import { LLMManager, LLMManagerConfig, LLMSummaryConfig } from './llm-manager';
import { PromptTemplateManager, PromptContext } from './prompt-templates';
import { TranscriptAggregator, AggregatedTranscript } from './transcript-aggregator';

export interface SummaryResult {
  id: string;
  type: 'summary' | 'topics' | 'action_items' | 'discussion_analysis' | 'meeting_minutes';
  content: string;
  topics?: string[];
  actionItems?: string[];
  confidence?: number;
  timestamp: number;
  duration: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SummarySession {
  id: string;
  startTime: number;
  endTime?: number;
  summaries: SummaryResult[];
  totalSummaries: number;
  averageConfidence: number;
  totalTokens: number;
  totalCost: number;
}

export interface SummaryServiceConfig {
  llmManager: LLMManager;
  transcriptAggregator: TranscriptAggregator;
  autoSummaryEnabled: boolean;
  summaryInterval: number; // ミリ秒
  summaryTypes: ('summary' | 'topics' | 'action_items')[];
  maxSummaryLength: number;
  language: string;
  meetingType: string;
  participants: string[];
}

export interface TopicCluster {
  id: string;
  name: string;
  keywords: string[];
  segments: string[];
  confidence: number;
  timestamp: number;
  duration: number;
}

export class SummaryService extends EventEmitter {
  private config: SummaryServiceConfig;
  private llmManager: LLMManager;
  private transcriptAggregator: TranscriptAggregator;
  private promptManager: PromptTemplateManager;
  private currentSession: SummarySession | null = null;
  private summaryTimer: NodeJS.Timeout | null = null;
  private serviceActive = false;
  private topicClusters: TopicCluster[] = [];
  private summaryHistory: SummaryResult[] = [];

  constructor(config: SummaryServiceConfig) {
    super();
    this.config = config;
    this.llmManager = config.llmManager;
    this.transcriptAggregator = config.transcriptAggregator;
    this.promptManager = new PromptTemplateManager();

    // トランスクリプト集約イベントを監視
    this.transcriptAggregator.on('batchProcessed', (transcript: AggregatedTranscript) => {
      this.onTranscriptUpdated(transcript);
    });

    // LLMマネージャーイベントを監視
    this.llmManager.on('summaryGenerated', (data) => {
      this.onSummaryGenerated(data);
    });

    this.llmManager.on('providerError', (data) => {
      this.emit('summaryError', { error: data.error, provider: data.type });
    });
  }

  /**
   * 要約サービスを開始
   */
  async start(): Promise<boolean> {
    try {
      // LLMマネージャーを初期化
      const isInitialized = await this.llmManager.initialize();
      if (!isInitialized) {
        throw new Error('LLMマネージャーの初期化に失敗しました');
      }

      // 新しいセッションを開始
      this.currentSession = {
        id: this.generateSessionId(),
        startTime: Date.now(),
        summaries: [],
        totalSummaries: 0,
        averageConfidence: 0,
        totalTokens: 0,
        totalCost: 0,
      };

      // 自動要約を開始
      if (this.config.autoSummaryEnabled) {
        this.startAutoSummary();
      }

      this.serviceActive = true;
      this.emit('started', { sessionId: this.currentSession.id });
      return true;
    } catch (error) {
      console.error('要約サービス開始エラー:', error);
      this.emit('error', { error, operation: 'start' });
      return false;
    }
  }

  /**
   * 要約サービスを停止
   */
  async stop(): Promise<void> {
    try {
      this.stopAutoSummary();
      
      if (this.currentSession) {
        this.currentSession.endTime = Date.now();
        this.emit('sessionEnded', this.currentSession);
      }

      this.serviceActive = false;
      this.emit('stopped');
    } catch (error) {
      console.error('要約サービス停止エラー:', error);
      this.emit('error', { error, operation: 'stop' });
    }
  }

  /**
   * 自動要約を開始
   */
  startAutoSummary(): void {
    if (this.summaryTimer) {
      return;
    }

    this.summaryTimer = setInterval(() => {
      this.performAutoSummary();
    }, this.config.summaryInterval);

    this.emit('autoSummaryStarted');
  }

  /**
   * 自動要約を停止
   */
  stopAutoSummary(): void {
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
      this.emit('autoSummaryStopped');
    }
  }

  /**
   * 手動で要約を実行
   */
  async generateSummary(
    type: 'summary' | 'topics' | 'action_items' | 'discussion_analysis' | 'meeting_minutes',
    transcript?: string
  ): Promise<SummaryResult> {
    try {
      const targetTranscript = transcript || await this.getLatestTranscript();
      
      if (!targetTranscript || targetTranscript.length === 0) {
        throw new Error('要約対象のトランスクリプトがありません');
      }

      const startTime = Date.now();
      
      // プロンプトテンプレートを取得
      const templateName = this.getTemplateNameForType(type);
      const context: PromptContext = {
        transcript: targetTranscript,
        language: this.config.language,
        maxLength: this.config.maxSummaryLength,
        meetingType: this.config.meetingType,
        participants: this.config.participants,
        duration: this.calculateSessionDuration(),
      };

      const { systemPrompt, userPrompt } = this.promptManager.generatePrompt(templateName, context);

      // LLMで要約を生成
      const response = await this.llmManager.generateText({
        prompt: userPrompt,
        systemPrompt,
        temperature: 0.3,
        maxTokens: this.config.maxSummaryLength,
      });

      const summaryResult: SummaryResult = {
        id: this.generateSummaryId(),
        type,
        content: response.text,
        confidence: 0.8, // デフォルト信頼度
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        usage: response.usage,
      };

      // 要約タイプに応じて追加情報を抽出
      if (type === 'topics') {
        summaryResult.topics = this.extractTopics(response.text);
      } else if (type === 'action_items') {
        summaryResult.actionItems = this.extractActionItems(response.text);
      }

      // セッションに追加
      if (this.currentSession) {
        this.currentSession.summaries.push(summaryResult);
        this.currentSession.totalSummaries++;
        this.updateSessionStats(summaryResult);
      }

      // 履歴に追加
      this.summaryHistory.push(summaryResult);

      this.emit('summaryGenerated', summaryResult);
      return summaryResult;
    } catch (error) {
      console.error('要約生成エラー:', error);
      this.emit('summaryError', { error, type });
      throw error;
    }
  }

  /**
   * 自動要約を実行
   */
  private async performAutoSummary(): Promise<void> {
    try {
      const transcript = await this.getLatestTranscript();
      
      if (!transcript || transcript.length === 0) {
        return;
      }

      // 各要約タイプで要約を生成
      for (const summaryType of this.config.summaryTypes) {
        try {
          await this.generateSummary(summaryType, transcript);
        } catch (error) {
          console.error(`自動要約生成エラー (${summaryType}):`, error);
        }
      }

      // トピッククラスタリングを更新
      await this.updateTopicClusters();
    } catch (error) {
      console.error('自動要約実行エラー:', error);
    }
  }

  /**
   * トピッククラスタリングを更新
   */
  private async updateTopicClusters(): Promise<void> {
    try {
      const topics = this.summaryHistory
        .filter(summary => summary.type === 'topics' && summary.topics)
        .flatMap(summary => summary.topics || [])
        .filter(Boolean);

      if (topics.length === 0) {
        return;
      }

      // トピックをクラスタリング（簡易的な実装）
      const clusters = this.clusterTopics(topics);
      
      this.topicClusters = clusters.map((cluster, index) => ({
        id: `cluster-${index}`,
        name: cluster.name,
        keywords: cluster.keywords,
        segments: cluster.segments,
        confidence: cluster.confidence,
        timestamp: Date.now(),
        duration: 0,
      }));

      this.emit('topicClustersUpdated', this.topicClusters);
    } catch (error) {
      console.error('トピッククラスタリング更新エラー:', error);
    }
  }

  /**
   * トピックをクラスタリング（簡易的な実装）
   */
  private clusterTopics(topics: string[]): Array<{
    name: string;
    keywords: string[];
    segments: string[];
    confidence: number;
  }> {
    // 簡易的なクラスタリング（実際の実装ではより高度なアルゴリズムを使用）
    const clusters: Map<string, string[]> = new Map();
    
    for (const topic of topics) {
      const normalizedTopic = topic.toLowerCase().trim();
      const key = this.findSimilarCluster(normalizedTopic, clusters);
      
      if (key) {
        clusters.get(key)!.push(topic);
      } else {
        clusters.set(normalizedTopic, [topic]);
      }
    }

    return Array.from(clusters.entries()).map(([name, topics]) => ({
      name,
      keywords: topics.slice(0, 5), // 上位5個をキーワードとして使用
      segments: topics,
      confidence: 0.7, // デフォルト信頼度
    }));
  }

  /**
   * 類似クラスターを検索
   */
  private findSimilarCluster(topic: string, clusters: Map<string, string[]>): string | null {
    for (const [key] of clusters) {
      if (this.calculateSimilarity(topic, key) > 0.5) {
        return key;
      }
    }
    return null;
  }

  /**
   * 類似度を計算（簡易的な実装）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const union = new Set([...words1, ...words2]);
    return intersection.length / union.size;
  }

  /**
   * トランスクリプト更新時の処理
   */
  private onTranscriptUpdated(transcript: AggregatedTranscript): void {
    this.emit('transcriptUpdated', transcript);
  }

  /**
   * 要約生成時の処理
   */
  private onSummaryGenerated(data: any): void {
    this.emit('llmSummaryGenerated', data);
  }

  /**
   * 最新のトランスクリプトを取得
   */
  private async getLatestTranscript(): Promise<string> {
    try {
      const latestTranscript = this.transcriptAggregator.getLatestTranscript();
      if (latestTranscript) {
        return latestTranscript.segments
          .map((segment: any) => segment.text)
          .join(' ');
      }
      return '';
    } catch (error) {
      console.error('トランスクリプト取得エラー:', error);
      return '';
    }
  }

  /**
   * セッション統計を更新
   */
  private updateSessionStats(summary: SummaryResult): void {
    if (!this.currentSession) return;

    if (summary.usage) {
      this.currentSession.totalTokens += summary.usage.totalTokens;
      // コスト計算（実際の実装ではプロバイダー別のコスト計算を使用）
      const cost = summary.usage.totalTokens * 0.00001; // 仮のコスト計算
      this.currentSession.totalCost += cost;
    }

    // 平均信頼度を更新
    const totalConfidence = this.currentSession.summaries.reduce((sum, s) => sum + (s.confidence || 0), 0);
    this.currentSession.averageConfidence = totalConfidence / this.currentSession.summaries.length;
  }

  /**
   * セッション時間を計算
   */
  private calculateSessionDuration(): number {
    if (!this.currentSession) return 0;
    return Math.floor((Date.now() - this.currentSession.startTime) / 1000 / 60); // 分単位
  }

  /**
   * 要約タイプに基づいてテンプレート名を取得
   */
  private getTemplateNameForType(type: string): string {
    switch (type) {
      case 'summary':
        return 'meeting_summary';
      case 'topics':
        return 'topic_extraction';
      case 'action_items':
        return 'action_items';
      case 'discussion_analysis':
        return 'discussion_analysis';
      case 'meeting_minutes':
        return 'meeting_minutes';
      default:
        return 'meeting_summary';
    }
  }

  /**
   * トピックを抽出
   */
  private extractTopics(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    return lines
      .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(topic => topic.length > 0);
  }

  /**
   * アクションアイテムを抽出
   */
  private extractActionItems(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    return lines
      .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(item => item.length > 0);
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 要約IDを生成
   */
  private generateSummaryId(): string {
    return `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 現在のセッションを取得
   */
  getCurrentSession(): SummarySession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * 要約履歴を取得
   */
  getSummaryHistory(): SummaryResult[] {
    return [...this.summaryHistory];
  }

  /**
   * トピッククラスターを取得
   */
  getTopicClusters(): TopicCluster[] {
    return [...this.topicClusters];
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<SummaryServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): SummaryServiceConfig {
    return { ...this.config };
  }

  /**
   * サービスがアクティブかどうかを確認
   */
  isActive(): boolean {
    return this.serviceActive;
  }

  /**
   * 自動要約が有効かどうかを確認
   */
  isAutoSummaryEnabled(): boolean {
    return this.config.autoSummaryEnabled && this.summaryTimer !== null;
  }
} 

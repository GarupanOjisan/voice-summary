import { EventEmitter } from 'events';
import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderInfo,
  LLMRequest,
  LLMResponse,
  LLMSummaryRequest,
  LLMSummaryResponse,
  LLMProviderStatus,
} from './llm-provider';
import { LLMProviderFactoryImpl } from './llm-provider-factory';

export interface LLMManagerConfig {
  defaultProvider: LLMProviderType;
  providers: {
    [key in LLMProviderType]?: LLMProviderConfig;
  };
  autoSwitch: boolean;
  fallbackProvider?: LLMProviderType;
  summaryInterval: number; // ミリ秒
  maxRetries: number;
  retryDelay: number;
}

export interface LLMSummaryConfig {
  enabled: boolean;
  interval: number;
  summaryTypes: ('summary' | 'topics' | 'action_items')[];
  maxLength: number;
  language: string;
}

export class LLMManager extends EventEmitter {
  private factory: LLMProviderFactoryImpl;
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private currentProvider: LLMProvider | null = null;
  private config: LLMManagerConfig;
  private summaryConfig: LLMSummaryConfig;
  private isActive = false;
  private summaryTimer: NodeJS.Timeout | null = null;

  constructor(config: LLMManagerConfig) {
    super();
    this.factory = new LLMProviderFactoryImpl();
    this.config = {
      ...config,
      summaryInterval: config.summaryInterval || 15000, // 15秒
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };

    this.summaryConfig = {
      enabled: true,
      interval: 15000,
      summaryTypes: ['summary', 'topics', 'action_items'],
      maxLength: 500,
      language: 'ja',
    };
  }

  /**
   * マネージャーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      // デフォルトプロバイダーを初期化
      const isInitialized = await this.initializeProvider(this.config.defaultProvider);
      
      if (isInitialized) {
        this.currentProvider = this.providers.get(this.config.defaultProvider) || null;
        console.log(`デフォルトLLMプロバイダー ${this.config.defaultProvider} を設定しました`);
      }

      return isInitialized;
    } catch (error) {
      console.error('LLMマネージャー初期化エラー:', error);
      return false;
    }
  }

  /**
   * プロバイダーを初期化
   */
  async initializeProvider(type: LLMProviderType): Promise<boolean> {
    try {
      if (this.providers.has(type)) {
        return this.providers.get(type)!.isProviderInitialized();
      }

      const providerConfig = this.config.providers[type];
      const provider = this.factory.createProvider(type, providerConfig);

      // イベントリスナーを設定
      provider.on('initialized', () => {
        this.emit('providerInitialized', { type });
      });

      provider.on('error', (error) => {
        this.emit('providerError', { type, error });
      });

      provider.on('textGenerated', (response) => {
        this.emit('textGenerated', { type, response });
      });

      provider.on('summaryGenerated', (response) => {
        this.emit('summaryGenerated', { type, response });
      });

      const isInitialized = await provider.initialize();
      if (isInitialized) {
        this.providers.set(type, provider);
      }

      return isInitialized;
    } catch (error) {
      console.error(`LLMプロバイダー初期化エラー (${type}):`, error);
      return false;
    }
  }

  /**
   * プロバイダーに切り替え
   */
  async switchToProvider(type: LLMProviderType): Promise<boolean> {
    try {
      // プロバイダーが初期化されていない場合は初期化
      if (!this.providers.has(type)) {
        const isInitialized = await this.initializeProvider(type);
        if (!isInitialized) {
          return false;
        }
      }

      this.currentProvider = this.providers.get(type) || null;
      this.emit('providerSwitched', { provider: type });
      
      console.log(`LLMプロバイダーを ${type} に切り替えました`);
      return true;
    } catch (error) {
      console.error(`LLMプロバイダー切り替えエラー:`, error);
      return false;
    }
  }

  /**
   * テキスト生成を実行
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.currentProvider) {
      throw new Error('現在のLLMプロバイダーが設定されていません');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.currentProvider.generateText(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`LLMテキスト生成エラー (試行 ${attempt}/${this.config.maxRetries}):`, lastError);

        // 自動切り替えが有効な場合、フォールバックプロバイダーを試行
        if (this.config.autoSwitch && this.config.fallbackProvider && attempt === 1) {
          console.log('フォールバックLLMプロバイダーに切り替えを試行します');
          const switched = await this.switchToProvider(this.config.fallbackProvider);
          if (switched) {
            continue; // 再試行
          }
        }

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('LLMテキスト生成に失敗しました');
  }

  /**
   * 要約を生成
   */
  async generateSummary(request: LLMSummaryRequest): Promise<LLMSummaryResponse> {
    if (!this.currentProvider) {
      throw new Error('現在のLLMプロバイダーが設定されていません');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.currentProvider.generateSummary(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`LLM要約生成エラー (試行 ${attempt}/${this.config.maxRetries}):`, lastError);

        // 自動切り替えが有効な場合、フォールバックプロバイダーを試行
        if (this.config.autoSwitch && this.config.fallbackProvider && attempt === 1) {
          console.log('フォールバックLLMプロバイダーに切り替えを試行します');
          const switched = await this.switchToProvider(this.config.fallbackProvider);
          if (switched) {
            continue; // 再試行
          }
        }

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('LLM要約生成に失敗しました');
  }

  /**
   * 自動要約を開始
   */
  startAutoSummary(): void {
    if (this.isActive || !this.summaryConfig.enabled) {
      return;
    }

    this.isActive = true;
    this.summaryTimer = setInterval(() => {
      this.performAutoSummary();
    }, this.summaryConfig.interval);

    this.emit('autoSummaryStarted');
  }

  /**
   * 自動要約を停止
   */
  stopAutoSummary(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }

    this.emit('autoSummaryStopped');
  }

  /**
   * 自動要約を実行
   */
  private async performAutoSummary(): Promise<void> {
    try {
      // 最新のトランスクリプトを取得（実際の実装ではトランスクリプトマネージャーから取得）
      const transcript = await this.getLatestTranscript();
      
      if (!transcript || transcript.length === 0) {
        return;
      }

      // 各要約タイプで要約を生成
      for (const summaryType of this.summaryConfig.summaryTypes) {
        try {
          const summary = await this.generateSummary({
            transcript,
            summaryType,
            maxLength: this.summaryConfig.maxLength,
            language: this.summaryConfig.language,
          });

          this.emit('autoSummaryGenerated', { summaryType, summary });
        } catch (error) {
          console.error(`自動要約生成エラー (${summaryType}):`, error);
        }
      }
    } catch (error) {
      console.error('自動要約実行エラー:', error);
    }
  }

  /**
   * 最新のトランスクリプトを取得（実際の実装ではトランスクリプトマネージャーから取得）
   */
  private async getLatestTranscript(): Promise<string> {
    // 実際の実装ではトランスクリプトマネージャーから最新のトランスクリプトを取得
    // ここでは簡易的な実装として空文字列を返す
    return '';
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * プロバイダーの状態を取得
   */
  getProviderStatus(): LLMProviderStatus[] {
    const statuses: LLMProviderStatus[] = [];

    for (const [type, provider] of this.providers) {
      statuses.push(provider.getStatus());
    }

    // 設定されているが初期化されていないプロバイダーも含める
    for (const type of Object.keys(this.config.providers)) {
      if (!this.providers.has(type as LLMProviderType)) {
        const providerInfo = this.factory.getProviderInfo(type as LLMProviderType);
        statuses.push({
          type: type as LLMProviderType,
          isInitialized: false,
          isAvailable: false,
        });
      }
    }

    return statuses;
  }

  /**
   * 現在のプロバイダーを取得
   */
  getCurrentProvider(): LLMProvider | null {
    return this.currentProvider;
  }

  /**
   * 現在のプロバイダータイプを取得
   */
  getCurrentProviderType(): LLMProviderType | null {
    return this.currentProvider?.getType() || null;
  }

  /**
   * サポートされているプロバイダーのリストを取得
   */
  getSupportedProviders(): LLMProviderType[] {
    return this.factory.getSupportedProviders();
  }

  /**
   * プロバイダー情報を取得
   */
  getProviderInfo(type: LLMProviderType): LLMProviderInfo {
    return this.factory.getProviderInfo(type);
  }

  /**
   * すべてのプロバイダー情報を取得
   */
  getAllProviderInfos(): LLMProviderInfo[] {
    return this.factory.getAllProviderInfos();
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<LLMManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 要約設定を更新
   */
  updateSummaryConfig(config: Partial<LLMSummaryConfig>): void {
    this.summaryConfig = { ...this.summaryConfig, ...config };
    this.emit('summaryConfigUpdated', this.summaryConfig);
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LLMManagerConfig {
    return { ...this.config };
  }

  /**
   * 要約設定を取得
   */
  getSummaryConfig(): LLMSummaryConfig {
    return { ...this.summaryConfig };
  }

  /**
   * 自動要約がアクティブかどうかを確認
   */
  isAutoSummaryActive(): boolean {
    return this.isActive;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    this.stopAutoSummary();

    for (const provider of this.providers.values()) {
      await provider.cleanup();
    }

    this.providers.clear();
    this.currentProvider = null;
    this.emit('cleanup');
  }
} 

import { EventEmitter } from 'events';
import {
  STTProvider,
  STTProviderConfig,
  STTProviderType,
  STTTranscriptionResult,
  STTStreamingOptions,
} from './stt-provider';
import { STTProviderFactory } from './stt-provider-factory';

export interface STTManagerConfig {
  defaultProvider: STTProviderType;
  providers: {
    [key in STTProviderType]?: STTProviderConfig;
  };
  autoSwitch: boolean;
  fallbackProvider?: STTProviderType;
}

export interface STTProviderStatus {
  type: STTProviderType;
  name: string;
  isInitialized: boolean;
  isStreaming: boolean;
  isAvailable: boolean;
  lastError?: string;
}

export class STTManager extends EventEmitter {
  private factory: STTProviderFactory;
  private providers: Map<STTProviderType, STTProvider> = new Map();
  private currentProvider: STTProvider | null = null;
  private config: STTManagerConfig;
  private isStreaming = false;

  constructor(config: STTManagerConfig) {
    super();
    this.factory = new STTProviderFactory();
    this.config = config;
  }

  /**
   * プロバイダーを初期化
   */
  async initializeProvider(type: STTProviderType): Promise<boolean> {
    try {
      const providerConfig = this.config.providers[type];
      if (!providerConfig) {
        throw new Error(`プロバイダー ${type} の設定が見つかりません`);
      }

      const provider = this.factory.createProvider(type, providerConfig);
      const isInitialized = await provider.initialize();

      if (isInitialized) {
        this.providers.set(type, provider);
        
        // イベントリスナーを設定
        provider.on('transcriptionResult', (result: STTTranscriptionResult) => {
          this.emit('transcriptionResult', { provider: type, result });
        });

        provider.on('transcriptionComplete', (result: STTTranscriptionResult) => {
          this.emit('transcriptionComplete', { provider: type, result });
        });

        provider.on('error', (error: Error) => {
          this.emit('providerError', { provider: type, error });
          
          // 自動切り替えが有効な場合、フォールバックプロバイダーに切り替え
          if (this.config.autoSwitch && this.config.fallbackProvider && type !== this.config.fallbackProvider) {
            this.switchToProvider(this.config.fallbackProvider);
          }
        });

        provider.on('streamingStarted', () => {
          this.emit('streamingStarted', { provider: type });
        });

        provider.on('streamingStopped', () => {
          this.emit('streamingStopped', { provider: type });
        });

        console.log(`プロバイダー ${type} を初期化しました`);
        return true;
      } else {
        console.error(`プロバイダー ${type} の初期化に失敗しました`);
        return false;
      }
    } catch (error) {
      console.error(`プロバイダー ${type} の初期化エラー:`, error);
      return false;
    }
  }

  /**
   * デフォルトプロバイダーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      const isInitialized = await this.initializeProvider(this.config.defaultProvider);
      
      if (isInitialized) {
        this.currentProvider = this.providers.get(this.config.defaultProvider) || null;
        console.log(`デフォルトプロバイダー ${this.config.defaultProvider} を設定しました`);
      }

      return isInitialized;
    } catch (error) {
      console.error('STTマネージャー初期化エラー:', error);
      return false;
    }
  }

  /**
   * プロバイダーに切り替え
   */
  async switchToProvider(type: STTProviderType): Promise<boolean> {
    try {
      // 現在のストリーミングを停止
      if (this.isStreaming) {
        await this.stopStreaming();
      }

      // プロバイダーが初期化されていない場合は初期化
      if (!this.providers.has(type)) {
        const isInitialized = await this.initializeProvider(type);
        if (!isInitialized) {
          return false;
        }
      }

      this.currentProvider = this.providers.get(type) || null;
      this.emit('providerSwitched', { provider: type });
      
      console.log(`プロバイダーを ${type} に切り替えました`);
      return true;
    } catch (error) {
      console.error(`プロバイダー切り替えエラー:`, error);
      return false;
    }
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreaming(options: STTStreamingOptions = {}): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('現在のプロバイダーが設定されていません');
    }

    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      await this.currentProvider.startStreaming(options);
      this.isStreaming = true;
      this.emit('streamingStarted');
    } catch (error) {
      console.error('ストリーミング開始エラー:', error);
      
      // 自動切り替えが有効な場合、フォールバックプロバイダーを試行
      if (this.config.autoSwitch && this.config.fallbackProvider) {
        console.log('フォールバックプロバイダーに切り替えを試行します');
        const switched = await this.switchToProvider(this.config.fallbackProvider);
        if (switched) {
          await this.startStreaming(options);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * ストリーミング音声認識を停止
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    try {
      if (this.currentProvider) {
        await this.currentProvider.stopStreaming();
      }
      this.isStreaming = false;
      this.emit('streamingStopped');
    } catch (error) {
      console.error('ストリーミング停止エラー:', error);
      throw error;
    }
  }

  /**
   * 音声データを送信
   */
  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('現在のプロバイダーが設定されていません');
    }

    try {
      await this.currentProvider.sendAudioData(data);
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  /**
   * ファイルを文字起こし
   */
  async transcribeFile(filePath: string): Promise<STTTranscriptionResult> {
    if (!this.currentProvider) {
      throw new Error('現在のプロバイダーが設定されていません');
    }

    try {
      return await this.currentProvider.transcribeFile(filePath);
    } catch (error) {
      console.error('ファイル文字起こしエラー:', error);
      throw error;
    }
  }

  /**
   * プロバイダーの状態を取得
   */
  getProviderStatus(): STTProviderStatus[] {
    const statuses: STTProviderStatus[] = [];

    for (const [type, provider] of this.providers) {
      statuses.push({
        type,
        name: provider.getProviderName(),
        isInitialized: true,
        isStreaming: provider.isStreamingActive(),
        isAvailable: true,
      });
    }

    // 設定されているが初期化されていないプロバイダーも含める
    for (const type of Object.keys(this.config.providers)) {
      if (!this.providers.has(type as STTProviderType)) {
        const providerInfo = this.factory.getProviderInfo(type as STTProviderType);
        statuses.push({
          type: type as STTProviderType,
          name: providerInfo.name,
          isInitialized: false,
          isStreaming: false,
          isAvailable: false,
        });
      }
    }

    return statuses;
  }

  /**
   * 現在のプロバイダーを取得
   */
  getCurrentProvider(): STTProvider | null {
    return this.currentProvider;
  }

  /**
   * 現在のプロバイダータイプを取得
   */
  getCurrentProviderType(): STTProviderType | null {
    if (!this.currentProvider) {
      return null;
    }

    for (const [type, provider] of this.providers) {
      if (provider === this.currentProvider) {
        return type;
      }
    }

    return null;
  }

  /**
   * ストリーミング状態を取得
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<STTManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * サポートされているプロバイダーを取得
   */
  getSupportedProviders(): STTProviderType[] {
    return this.factory.getSupportedProviders();
  }

  /**
   * プロバイダー情報を取得
   */
  getProviderInfo(type: STTProviderType) {
    return this.factory.getProviderInfo(type);
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isStreaming) {
        await this.stopStreaming();
      }

      // すべてのプロバイダーをクリーンアップ
      for (const provider of this.providers.values()) {
        if (provider.isStreamingActive()) {
          await provider.stopStreaming();
        }
      }

      this.providers.clear();
      this.currentProvider = null;
      this.emit('cleanup');
    } catch (error) {
      console.error('STTマネージャークリーンアップエラー:', error);
      throw error;
    }
  }
} 

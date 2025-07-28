import { EventEmitter } from 'events';
import {
  STTProvider,
  STTProviderType,
  STTTranscriptionResult,
  STTStreamingOptions,
  STTProviderConfig,
} from './stt-provider';
import { STTManager, STTManagerConfig } from './stt-manager';
import { STTProviderFactory } from './stt-provider-factory';

export interface STTEngineConfig {
  defaultProvider: STTProviderType;
  providers: {
    [key in STTProviderType]?: STTProviderConfig;
  };
  autoSwitch: boolean;
  fallbackProvider?: STTProviderType;
  retryAttempts: number;
  retryDelay: number;
  connectionTimeout: number;
  maxConcurrentRequests: number;
}

export interface STTEngineOptions {
  language?: string;
  model?: string;
  interimResults?: boolean;
  punctuate?: boolean;
  profanityFilter?: boolean;
  smartFormat?: boolean;
  diarize?: boolean;
  speakerLabels?: boolean;
  confidenceThreshold?: number;
  maxAlternatives?: number;
}

export interface STTEngineStatus {
  isInitialized: boolean;
  isStreaming: boolean;
  currentProvider: STTProviderType | null;
  availableProviders: STTProviderType[];
  errorCount: number;
  lastError?: string;
  uptime: number;
  totalTranscriptions: number;
  averageLatency: number;
}

export interface STTEngineMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalAudioProcessed: number;
  providerUsage: {
    [key in STTProviderType]?: {
      requests: number;
      successRate: number;
      averageLatency: number;
    };
  };
}

export class STTEngine extends EventEmitter {
  private manager: STTManager;
  private factory: STTProviderFactory;
  private config: STTEngineConfig;
  private status: STTEngineStatus;
  private metrics: STTEngineMetrics;
  private startTime: number;
  private retryQueue: Array<{
    id: string;
    task: () => Promise<any>;
    attempts: number;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue = false;

  constructor(config: STTEngineConfig) {
    super();
    this.config = config;
    this.factory = new STTProviderFactory();
    this.startTime = Date.now();
    
    // 初期状態
    this.status = {
      isInitialized: false,
      isStreaming: false,
      currentProvider: null,
      availableProviders: [],
      errorCount: 0,
      uptime: 0,
      totalTranscriptions: 0,
      averageLatency: 0,
    };

    // メトリクス初期化
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalAudioProcessed: 0,
      providerUsage: {},
    };

    // STTマネージャーを初期化
    const managerConfig: STTManagerConfig = {
      defaultProvider: config.defaultProvider,
      providers: config.providers,
      autoSwitch: config.autoSwitch,
      fallbackProvider: config.fallbackProvider,
    };
    
    this.manager = new STTManager(managerConfig);
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // STTマネージャーのイベントを転送
    this.manager.on('transcriptionResult', (data) => {
      this.updateMetrics('success');
      this.emit('transcriptionResult', data);
    });

    this.manager.on('transcriptionComplete', (data) => {
      this.updateMetrics('success');
      this.emit('transcriptionComplete', data);
    });

    this.manager.on('providerError', (data) => {
      this.updateMetrics('failure');
      this.status.errorCount++;
      this.status.lastError = data.error.message;
      this.emit('providerError', data);
    });

    this.manager.on('providerSwitched', (data) => {
      this.status.currentProvider = data.provider;
      this.emit('providerSwitched', data);
    });

    this.manager.on('streamingStarted', (data) => {
      this.status.isStreaming = true;
      this.emit('streamingStarted', data);
    });

    this.manager.on('streamingStopped', (data) => {
      this.status.isStreaming = false;
      this.emit('streamingStopped', data);
    });

    this.manager.on('configUpdated', (config) => {
      this.config = { ...this.config, ...config };
      this.emit('configUpdated', config);
    });
  }

  /**
   * STTエンジンを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      const isInitialized = await this.manager.initialize();
      
      if (isInitialized) {
        this.status.isInitialized = true;
        this.status.currentProvider = this.config.defaultProvider;
        this.status.availableProviders = this.manager.getSupportedProviders();
        
        // 各プロバイダーの使用統計を初期化
        for (const provider of this.status.availableProviders) {
          this.metrics.providerUsage[provider] = {
            requests: 0,
            successRate: 0,
            averageLatency: 0,
          };
        }
        
        this.emit('initialized');
        console.log('STTエンジンが初期化されました');
        return true;
      } else {
        throw new Error('STTマネージャーの初期化に失敗しました');
      }
    } catch (error) {
      this.status.errorCount++;
      this.status.lastError = (error as Error).message;
      this.emit('initializationError', error);
      console.error('STTエンジン初期化エラー:', error);
      return false;
    }
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreaming(options: STTEngineOptions = {}): Promise<void> {
    try {
      const startTime = Date.now();
      
      await this.manager.startStreaming(options);
      
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      
      this.emit('streamingStarted');
    } catch (error) {
      this.handleError(error as Error, 'startStreaming');
      throw error;
    }
  }

  /**
   * ストリーミング音声認識を停止
   */
  async stopStreaming(): Promise<void> {
    try {
      await this.manager.stopStreaming();
      this.emit('streamingStopped');
    } catch (error) {
      this.handleError(error as Error, 'stopStreaming');
      throw error;
    }
  }

  /**
   * 音声データを送信
   */
  async sendAudioData(data: Buffer): Promise<void> {
    try {
      const startTime = Date.now();
      
      await this.manager.sendAudioData(data);
      
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.metrics.totalAudioProcessed += data.length;
      
    } catch (error) {
      this.handleError(error as Error, 'sendAudioData');
      throw error;
    }
  }

  /**
   * ファイルを文字起こし
   */
  async transcribeFile(filePath: string, options: STTEngineOptions = {}): Promise<STTTranscriptionResult> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      const result = await this.manager.transcribeFile(filePath);
      
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.status.totalTranscriptions++;
      
      return result;
    });
  }

  /**
   * プロバイダーを切り替え
   */
  async switchProvider(providerType: STTProviderType): Promise<boolean> {
    try {
      const success = await this.manager.switchToProvider(providerType);
      
      if (success) {
        this.status.currentProvider = providerType;
        this.emit('providerSwitched', { provider: providerType });
      }
      
      return success;
    } catch (error) {
      this.handleError(error as Error, 'switchProvider');
      return false;
    }
  }

  /**
   * プロバイダーを初期化
   */
  async initializeProvider(providerType: STTProviderType): Promise<boolean> {
    try {
      const success = await this.manager.initializeProvider(providerType);
      
      if (success) {
        this.emit('providerInitialized', { provider: providerType });
      }
      
      return success;
    } catch (error) {
      this.handleError(error as Error, 'initializeProvider');
      return false;
    }
  }

  /**
   * リトライ機能付きでタスクを実行
   */
  private async executeWithRetry<T>(task: () => Promise<T>): Promise<T> {
    const taskId = Math.random().toString(36).substr(2, 9);
    
    return new Promise((resolve, reject) => {
      this.retryQueue.push({
        id: taskId,
        task,
        attempts: 0,
        resolve,
        reject,
      });
      
      this.processRetryQueue();
    });
  }

  /**
   * リトライキューを処理
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessingQueue || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.retryQueue.length > 0) {
      const item = this.retryQueue.shift()!;
      
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (error) {
        item.attempts++;
        
        if (item.attempts < this.config.retryAttempts) {
          // リトライ
          setTimeout(() => {
            this.retryQueue.push(item);
            this.processRetryQueue();
          }, this.config.retryDelay);
        } else {
          // 最大リトライ回数に達した
          item.reject(error as Error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: Error, operation: string): void {
    this.status.errorCount++;
    this.status.lastError = error.message;
    this.updateMetrics('failure');
    
    this.emit('error', {
      error,
      operation,
      timestamp: Date.now(),
    });
    
    console.error(`STTエンジンエラー (${operation}):`, error);
  }

  /**
   * メトリクスを更新
   */
  private updateMetrics(result: 'success' | 'failure'): void {
    this.metrics.totalRequests++;
    
    if (result === 'success') {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // プロバイダー別の使用統計を更新
    const currentProvider = this.status.currentProvider;
    if (currentProvider && this.metrics.providerUsage[currentProvider]) {
      const usage = this.metrics.providerUsage[currentProvider]!;
      usage.requests++;
      usage.successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    }
  }

  /**
   * レイテンシーメトリクスを更新
   */
  private updateLatencyMetrics(latency: number): void {
    const currentProvider = this.status.currentProvider;
    
    if (currentProvider && this.metrics.providerUsage[currentProvider]) {
      const usage = this.metrics.providerUsage[currentProvider]!;
      usage.averageLatency = (usage.averageLatency + latency) / 2;
    }
    
    this.status.averageLatency = (this.status.averageLatency + latency) / 2;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + latency) / 2;
  }

  /**
   * エンジンの状態を取得
   */
  getStatus(): STTEngineStatus {
    this.status.uptime = Date.now() - this.startTime;
    return { ...this.status };
  }

  /**
   * メトリクスを取得
   */
  getMetrics(): STTEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * 設定を取得
   */
  getConfig(): STTEngineConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<STTEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.manager.updateConfig(config);
    this.emit('configUpdated', this.config);
  }

  /**
   * 現在のプロバイダーを取得
   */
  getCurrentProvider(): STTProviderType | null {
    return this.status.currentProvider;
  }

  /**
   * 利用可能なプロバイダーを取得
   */
  getAvailableProviders(): STTProviderType[] {
    return this.status.availableProviders;
  }

  /**
   * ストリーミング状態を取得
   */
  isStreaming(): boolean {
    return this.status.isStreaming;
  }

  /**
   * 初期化状態を取得
   */
  isInitialized(): boolean {
    return this.status.isInitialized;
  }

  /**
   * エンジンをリセット
   */
  async reset(): Promise<void> {
    try {
      if (this.status.isStreaming) {
        await this.stopStreaming();
      }
      
      // メトリクスをリセット
      this.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalAudioProcessed: 0,
        providerUsage: {},
      };
      
      // 状態をリセット
      this.status = {
        isInitialized: false,
        isStreaming: false,
        currentProvider: null,
        availableProviders: [],
        errorCount: 0,
        uptime: 0,
        totalTranscriptions: 0,
        averageLatency: 0,
      };
      
      this.emit('reset');
    } catch (error) {
      this.handleError(error as Error, 'reset');
      throw error;
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (this.status.isStreaming) {
        await this.stopStreaming();
      }
      
      await this.manager.cleanup();
      this.emit('cleanup');
    } catch (error) {
      this.handleError(error as Error, 'cleanup');
      throw error;
    }
  }
} 

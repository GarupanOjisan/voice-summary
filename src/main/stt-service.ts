import { EventEmitter } from 'events';
import path from 'path';
import {
  STTEngine,
  STTEngineConfig,
  STTEngineOptions,
  STTEngineStatus,
  STTEngineMetrics,
} from './stt-engine';
import {
  STTConfigManager,
  STTConfigProfile,
  STTConfigManagerConfig,
} from './stt-config-manager';
import {
  STTErrorHandler,
  STTErrorHandlerConfig,
  STTError,
  STTErrorType,
  STTErrorSeverity,
  STTErrorStats,
} from './stt-error-handler';
import { STTProviderType } from './stt-provider';

export interface STTServiceConfig {
  configDir: string;
  defaultProfileId: string;
  errorHandlerConfig: STTErrorHandlerConfig;
  configManagerConfig: STTConfigManagerConfig;
}

export interface STTServiceStatus {
  isInitialized: boolean;
  isStreaming: boolean;
  currentProfile: STTConfigProfile | null;
  engineStatus: STTEngineStatus;
  errorStats: STTErrorStats;
  uptime: number;
}

export class STTService extends EventEmitter {
  private config: STTServiceConfig;
  private engine: STTEngine | null = null;
  private configManager: STTConfigManager;
  private errorHandler: STTErrorHandler;
  private startTime: number;
  private isInitialized = false;

  constructor(config: STTServiceConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();
    
    // 設定マネージャーを初期化
    this.configManager = new STTConfigManager(config.configManagerConfig);
    
    // エラーハンドラーを初期化
    this.errorHandler = new STTErrorHandler(config.errorHandlerConfig);
    
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // 設定マネージャーのイベントを転送
    this.configManager.on('profileCreated', (profile) => {
      this.emit('profileCreated', profile);
    });

    this.configManager.on('profileUpdated', (profile) => {
      this.emit('profileUpdated', profile);
    });

    this.configManager.on('profileDeleted', (profile) => {
      this.emit('profileDeleted', profile);
    });

    this.configManager.on('currentProfileChanged', (profile) => {
      this.emit('currentProfileChanged', profile);
      this.reinitializeEngine();
    });

    // エラーハンドラーのイベントを転送
    this.errorHandler.on('error', (error) => {
      this.emit('error', error);
    });

    this.errorHandler.on('criticalError', (error) => {
      this.emit('criticalError', error);
    });

    this.errorHandler.on('errorThresholdExceeded', (data) => {
      this.emit('errorThresholdExceeded', data);
    });
  }

  /**
   * STTサービスを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      const currentProfile = this.configManager.getCurrentProfile();
      if (!currentProfile) {
        throw new Error('現在のプロファイルが見つかりません');
      }

      // STTエンジンを初期化
      this.engine = new STTEngine(currentProfile.engineConfig);
      
      // エンジンのイベントを転送
      this.engine.on('transcriptionResult', (data) => {
        this.emit('transcriptionResult', data);
      });

      this.engine.on('transcriptionComplete', (data) => {
        this.emit('transcriptionComplete', data);
      });

      this.engine.on('providerError', (data) => {
        this.errorHandler.handleError(
          data.error,
          STTErrorType.PROVIDER_ERROR,
          STTErrorSeverity.MEDIUM,
          { provider: data.provider }
        );
      });

      this.engine.on('streamingStarted', (data) => {
        this.emit('streamingStarted', data);
      });

      this.engine.on('streamingStopped', (data) => {
        this.emit('streamingStopped', data);
      });

      // エンジンを初期化
      const engineInitialized = await this.engine.initialize();
      if (!engineInitialized) {
        throw new Error('STTエンジンの初期化に失敗しました');
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('STTサービスが初期化されました');
      return true;

    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.INITIALIZATION_ERROR,
        STTErrorSeverity.HIGH,
        { operation: 'initialize' }
      );
      return false;
    }
  }

  /**
   * エンジンを再初期化
   */
  private async reinitializeEngine(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.cleanup();
      } catch (error) {
        console.error('エンジンクリーンアップエラー:', error);
      }
    }

    await this.initialize();
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreaming(options: STTEngineOptions = {}): Promise<void> {
    if (!this.engine || !this.isInitialized) {
      throw new Error('STTサービスが初期化されていません');
    }

    try {
      const currentProfile = this.configManager.getCurrentProfile();
      if (!currentProfile) {
        throw new Error('現在のプロファイルが見つかりません');
      }

      // プロファイルのデフォルトオプションとマージ
      const mergedOptions = { ...currentProfile.defaultOptions, ...options };
      
      await this.engine.startStreaming(mergedOptions);
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.CONNECTION_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'startStreaming' }
      );
      throw error;
    }
  }

  /**
   * ストリーミング音声認識を停止
   */
  async stopStreaming(): Promise<void> {
    if (!this.engine) {
      return;
    }

    try {
      await this.engine.stopStreaming();
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.CONNECTION_ERROR,
        STTErrorSeverity.LOW,
        { operation: 'stopStreaming' }
      );
      throw error;
    }
  }

  /**
   * 音声データを送信
   */
  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.engine || !this.isInitialized) {
      throw new Error('STTサービスが初期化されていません');
    }

    try {
      await this.engine.sendAudioData(data);
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.NETWORK_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'sendAudioData' }
      );
      throw error;
    }
  }

  /**
   * ファイルを文字起こし
   */
  async transcribeFile(filePath: string, options: STTEngineOptions = {}): Promise<any> {
    if (!this.engine || !this.isInitialized) {
      throw new Error('STTサービスが初期化されていません');
    }

    try {
      const currentProfile = this.configManager.getCurrentProfile();
      if (!currentProfile) {
        throw new Error('現在のプロファイルが見つかりません');
      }

      // プロファイルのデフォルトオプションとマージ
      const mergedOptions = { ...currentProfile.defaultOptions, ...options };
      
      return await this.engine.transcribeFile(filePath, mergedOptions);
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.PROVIDER_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'transcribeFile' }
      );
      throw error;
    }
  }

  /**
   * プロファイルを切り替え
   */
  async switchProfile(profileId: string): Promise<boolean> {
    try {
      const success = this.configManager.setCurrentProfile(profileId);
      if (success) {
        await this.reinitializeEngine();
      }
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.INITIALIZATION_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'switchProfile' }
      );
      return false;
    }
  }

  /**
   * プロファイルを作成
   */
  createProfile(
    name: string,
    engineConfig: STTEngineConfig,
    defaultOptions: STTEngineOptions,
    description?: string
  ): string {
    return this.configManager.createProfile(name, engineConfig, defaultOptions, description);
  }

  /**
   * プロファイルを更新
   */
  updateProfile(
    id: string,
    updates: Partial<Omit<STTConfigProfile, 'id' | 'createdAt'>>
  ): boolean {
    return this.configManager.updateProfile(id, updates);
  }

  /**
   * プロファイルを削除
   */
  deleteProfile(id: string): boolean {
    return this.configManager.deleteProfile(id);
  }

  /**
   * プロファイルを取得
   */
  getProfile(id: string): STTConfigProfile | null {
    return this.configManager.getProfile(id);
  }

  /**
   * すべてのプロファイルを取得
   */
  getAllProfiles(): STTConfigProfile[] {
    return this.configManager.getAllProfiles();
  }

  /**
   * 現在のプロファイルを取得
   */
  getCurrentProfile(): STTConfigProfile | null {
    return this.configManager.getCurrentProfile();
  }

  /**
   * プロバイダーを切り替え
   */
  async switchProvider(providerType: STTProviderType): Promise<boolean> {
    if (!this.engine) {
      return false;
    }

    try {
      return await this.engine.switchProvider(providerType);
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.PROVIDER_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'switchProvider' }
      );
      return false;
    }
  }

  /**
   * プロバイダーを初期化
   */
  async initializeProvider(providerType: STTProviderType): Promise<boolean> {
    if (!this.engine) {
      return false;
    }

    try {
      return await this.engine.initializeProvider(providerType);
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.INITIALIZATION_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'initializeProvider' }
      );
      return false;
    }
  }

  /**
   * サービスの状態を取得
   */
  getStatus(): STTServiceStatus {
    const currentProfile = this.configManager.getCurrentProfile();
    const engineStatus = this.engine?.getStatus() || {
      isInitialized: false,
      isStreaming: false,
      currentProvider: null,
      availableProviders: [],
      errorCount: 0,
      uptime: 0,
      totalTranscriptions: 0,
      averageLatency: 0,
    };
    const errorStats = this.errorHandler.getErrorStats();

    return {
      isInitialized: this.isInitialized,
      isStreaming: engineStatus.isStreaming,
      currentProfile,
      engineStatus,
      errorStats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * エンジンのメトリクスを取得
   */
  getMetrics(): STTEngineMetrics | null {
    return this.engine?.getMetrics() || null;
  }

  /**
   * エラー統計を取得
   */
  getErrorStats(): STTErrorStats {
    return this.errorHandler.getErrorStats();
  }

  /**
   * 最近のエラーを取得
   */
  getRecentErrors(count: number = 10): STTError[] {
    return this.errorHandler.getRecentErrors(count);
  }

  /**
   * エラーを解決済みとしてマーク
   */
  resolveError(errorId: string): boolean {
    return this.errorHandler.resolveError(errorId);
  }

  /**
   * エラーをクリア
   */
  clearErrors(): void {
    this.errorHandler.clearErrors();
  }

  /**
   * 設定を保存
   */
  saveConfig(): void {
    this.configManager.save();
  }

  /**
   * 設定をリロード
   */
  reloadConfig(): void {
    this.configManager.reload();
  }

  /**
   * 設定をリセット
   */
  resetConfig(): void {
    this.configManager.reset();
  }

  /**
   * プロファイルをエクスポート
   */
  exportProfile(id: string): string | null {
    return this.configManager.exportProfile(id);
  }

  /**
   * プロファイルをインポート
   */
  importProfile(profileData: string): string | null {
    return this.configManager.importProfile(profileData);
  }

  /**
   * 現在のプロバイダーを取得
   */
  getCurrentProvider(): STTProviderType | null {
    return this.engine?.getCurrentProvider() || null;
  }

  /**
   * 利用可能なプロバイダーを取得
   */
  getAvailableProviders(): STTProviderType[] {
    return this.engine?.getAvailableProviders() || [];
  }

  /**
   * ストリーミング状態を取得
   */
  isStreaming(): boolean {
    return this.engine?.isStreaming() || false;
  }

  /**
   * 初期化状態を取得
   */
  getInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * サービスをリセット
   */
  async reset(): Promise<void> {
    try {
      if (this.engine) {
        await this.engine.reset();
      }
      this.errorHandler.clearErrors();
      this.emit('reset');
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.UNKNOWN_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'reset' }
      );
      throw error;
    }
  }

  /**
   * サービスをクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (this.engine) {
        await this.engine.cleanup();
      }
      this.isInitialized = false;
      this.emit('cleanup');
    } catch (error) {
      this.errorHandler.handleError(
        error as Error,
        STTErrorType.UNKNOWN_ERROR,
        STTErrorSeverity.MEDIUM,
        { operation: 'cleanup' }
      );
      throw error;
    }
  }
} 

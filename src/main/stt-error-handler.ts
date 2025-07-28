import { EventEmitter } from 'events';

export enum STTErrorType {
  INITIALIZATION_ERROR = 'initialization_error',
  CONNECTION_ERROR = 'connection_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  QUOTA_EXCEEDED_ERROR = 'quota_exceeded_error',
  INVALID_REQUEST_ERROR = 'invalid_request_error',
  PROVIDER_ERROR = 'provider_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error',
}

export enum STTErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface STTError {
  id: string;
  type: STTErrorType;
  severity: STTErrorSeverity;
  message: string;
  details?: any;
  provider?: string;
  operation?: string;
  timestamp: Date;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface STTErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  logErrors: boolean;
  notifyOnCritical: boolean;
  errorThreshold: number;
  autoRecovery: boolean;
}

export interface STTErrorStats {
  totalErrors: number;
  errorsByType: { [key in STTErrorType]?: number };
  errorsBySeverity: { [key in STTErrorSeverity]?: number };
  errorsByProvider: { [key: string]: number };
  recentErrors: STTError[];
  averageRecoveryTime: number;
  lastError?: STTError;
}

export class STTErrorHandler extends EventEmitter {
  private config: STTErrorHandlerConfig;
  private errors: STTError[] = [];
  private retryQueue: Map<string, {
    error: STTError;
    retryCount: number;
    nextRetry: number;
  }> = new Map();
  private stats: STTErrorStats;
  private recoveryTimes: number[] = [];

  constructor(config: STTErrorHandlerConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
  }

  /**
   * 統計情報を初期化
   */
  private initializeStats(): STTErrorStats {
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsByProvider: {},
      recentErrors: [],
      averageRecoveryTime: 0,
    };
  }

  /**
   * エラーを処理
   */
  handleError(
    error: Error | string,
    type: STTErrorType = STTErrorType.UNKNOWN_ERROR,
    severity: STTErrorSeverity = STTErrorSeverity.MEDIUM,
    context?: {
      provider?: string;
      operation?: string;
      details?: any;
    }
  ): STTError {
    const sttError: STTError = {
      id: this.generateErrorId(),
      type,
      severity,
      message: typeof error === 'string' ? error : error.message,
      details: typeof error === 'string' ? undefined : error,
      provider: context?.provider,
      operation: context?.operation,
      timestamp: new Date(),
      retryable: this.isRetryable(type, severity),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    this.addError(sttError);
    this.updateStats(sttError);
    this.emit('error', sttError);

    // ログ出力
    if (this.config.logErrors) {
      this.logError(sttError);
    }

    // 重大なエラーの通知
    if (this.config.notifyOnCritical && severity === STTErrorSeverity.CRITICAL) {
      this.emit('criticalError', sttError);
    }

    // 自動復旧の試行
    if (this.config.autoRecovery && sttError.retryable) {
      this.scheduleRetry(sttError);
    }

    // エラー閾値のチェック
    this.checkErrorThreshold();

    return sttError;
  }

  /**
   * エラーを追加
   */
  private addError(error: STTError): void {
    this.errors.push(error);
    
    // 最近のエラーを保持（最新100件）
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
  }

  /**
   * 統計情報を更新
   */
  private updateStats(error: STTError): void {
    this.stats.totalErrors++;
    
    // エラータイプ別統計
    this.stats.errorsByType[error.type] = (this.stats.errorsByType[error.type] || 0) + 1;
    
    // 重要度別統計
    this.stats.errorsBySeverity[error.severity] = (this.stats.errorsBySeverity[error.severity] || 0) + 1;
    
    // プロバイダー別統計
    if (error.provider) {
      this.stats.errorsByProvider[error.provider] = (this.stats.errorsByProvider[error.provider] || 0) + 1;
    }
    
    // 最近のエラー
    this.stats.recentErrors.unshift(error);
    if (this.stats.recentErrors.length > 10) {
      this.stats.recentErrors = this.stats.recentErrors.slice(0, 10);
    }
    
    this.stats.lastError = error;
  }

  /**
   * リトライ可能かどうかを判定
   */
  private isRetryable(type: STTErrorType, severity: STTErrorSeverity): boolean {
    // 重大度が高いエラーはリトライしない
    if (severity === STTErrorSeverity.CRITICAL) {
      return false;
    }

    // 特定のエラータイプはリトライ可能
    const retryableTypes = [
      STTErrorType.CONNECTION_ERROR,
      STTErrorType.NETWORK_ERROR,
      STTErrorType.TIMEOUT_ERROR,
      STTErrorType.RATE_LIMIT_ERROR,
    ];

    return retryableTypes.includes(type);
  }

  /**
   * リトライをスケジュール
   */
  private scheduleRetry(error: STTError): void {
    const retryCount = (error.retryCount || 0) + 1;
    
    if (retryCount > this.config.maxRetries) {
      this.emit('maxRetriesExceeded', error);
      return;
    }

    const delay = this.calculateRetryDelay(retryCount);
    const nextRetry = Date.now() + delay;

    this.retryQueue.set(error.id, {
      error: { ...error, retryCount },
      retryCount,
      nextRetry,
    });

    setTimeout(() => {
      this.executeRetry(error.id);
    }, delay);

    this.emit('retryScheduled', { error, retryCount, delay });
  }

  /**
   * リトライ遅延を計算
   */
  private calculateRetryDelay(retryCount: number): number {
    if (this.config.exponentialBackoff) {
      return this.config.retryDelay * Math.pow(2, retryCount - 1);
    }
    return this.config.retryDelay;
  }

  /**
   * リトライを実行
   */
  private executeRetry(errorId: string): void {
    const retryItem = this.retryQueue.get(errorId);
    if (!retryItem) {
      return;
    }

    this.retryQueue.delete(errorId);
    this.emit('retryExecuted', retryItem.error);
  }

  /**
   * エラー閾値のチェック
   */
  private checkErrorThreshold(): void {
    const recentErrors = this.errors.filter(
      error => Date.now() - error.timestamp.getTime() < 60000 // 1分以内
    );

    if (recentErrors.length >= this.config.errorThreshold) {
      this.emit('errorThresholdExceeded', {
        count: recentErrors.length,
        threshold: this.config.errorThreshold,
        errors: recentErrors,
      });
    }
  }

  /**
   * エラーをログ出力
   */
  private logError(error: STTError): void {
    const logMessage = `[STT Error] ${error.type} (${error.severity}): ${error.message}`;
    
    switch (error.severity) {
      case STTErrorSeverity.LOW:
        console.log(logMessage);
        break;
      case STTErrorSeverity.MEDIUM:
        console.warn(logMessage);
        break;
      case STTErrorSeverity.HIGH:
        console.error(logMessage);
        break;
      case STTErrorSeverity.CRITICAL:
        console.error(`🚨 CRITICAL: ${logMessage}`);
        break;
    }

    if (error.details) {
      console.error('Error details:', error.details);
    }
  }

  /**
   * エラーIDを生成
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * エラーを解決済みとしてマーク
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (!error) {
      return false;
    }

    const recoveryTime = Date.now() - error.timestamp.getTime();
    this.recoveryTimes.push(recoveryTime);
    
    // 平均復旧時間を更新
    this.stats.averageRecoveryTime = this.recoveryTimes.reduce((a, b) => a + b, 0) / this.recoveryTimes.length;

    this.emit('errorResolved', { error, recoveryTime });
    return true;
  }

  /**
   * エラー統計を取得
   */
  getErrorStats(): STTErrorStats {
    return { ...this.stats };
  }

  /**
   * 最近のエラーを取得
   */
  getRecentErrors(count: number = 10): STTError[] {
    return this.errors.slice(-count);
  }

  /**
   * 特定のタイプのエラーを取得
   */
  getErrorsByType(type: STTErrorType): STTError[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * 特定の重要度のエラーを取得
   */
  getErrorsBySeverity(severity: STTErrorSeverity): STTError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * 特定のプロバイダーのエラーを取得
   */
  getErrorsByProvider(provider: string): STTError[] {
    return this.errors.filter(error => error.provider === provider);
  }

  /**
   * エラーをクリア
   */
  clearErrors(): void {
    this.errors = [];
    this.retryQueue.clear();
    this.stats = this.initializeStats();
    this.recoveryTimes = [];
    this.emit('errorsCleared');
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<STTErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 設定を取得
   */
  getConfig(): STTErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * リトライキューを取得
   */
  getRetryQueue(): Array<{ error: STTError; retryCount: number; nextRetry: number }> {
    return Array.from(this.retryQueue.values());
  }

  /**
   * リトライをキャンセル
   */
  cancelRetry(errorId: string): boolean {
    const cancelled = this.retryQueue.delete(errorId);
    if (cancelled) {
      this.emit('retryCancelled', errorId);
    }
    return cancelled;
  }

  /**
   * すべてのリトライをキャンセル
   */
  cancelAllRetries(): void {
    const count = this.retryQueue.size;
    this.retryQueue.clear();
    this.emit('allRetriesCancelled', count);
  }
} 

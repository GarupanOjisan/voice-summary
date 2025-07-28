import { EventEmitter } from 'events';

export enum LLMProviderType {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  LOCAL_LLAMA = 'local_llama',
}

export interface LLMProviderConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
  latency?: number;
}

export interface LLMSummaryRequest {
  transcript: string;
  summaryType: 'summary' | 'topics' | 'action_items';
  maxLength?: number;
  language?: string;
}

export interface LLMSummaryResponse {
  summary: string;
  topics?: string[];
  actionItems?: string[];
  confidence?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderInfo {
  type: LLMProviderType;
  name: string;
  description: string;
  supportedModels: string[];
  maxTokens: number;
  supportsStreaming: boolean;
  requiresApiKey: boolean;
  isLocal: boolean;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface LLMProviderStatus {
  type: LLMProviderType;
  isInitialized: boolean;
  isAvailable: boolean;
  lastError?: string;
  model?: string;
  usage?: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  };
}

export abstract class LLMProvider extends EventEmitter {
  protected config: LLMProviderConfig;
  protected type: LLMProviderType;
  protected isInitialized = false;
  protected status: LLMProviderStatus;

  constructor(type: LLMProviderType, config: LLMProviderConfig = {}) {
    super();
    this.type = type;
    this.config = {
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.status = {
      type,
      isInitialized: false,
      isAvailable: false,
      usage: {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
      },
    };
  }

  /**
   * プロバイダーを初期化
   */
  abstract initialize(): Promise<boolean>;

  /**
   * プロバイダー情報を取得
   */
  abstract getProviderInfo(): LLMProviderInfo;

  /**
   * テキスト生成を実行
   */
  abstract generateText(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 要約を生成
   */
  abstract generateSummary(request: LLMSummaryRequest): Promise<LLMSummaryResponse>;

  /**
   * ストリーミングテキスト生成を実行
   */
  abstract generateTextStream(request: LLMRequest): AsyncGenerator<string>;

  /**
   * プロバイダーの状態を取得
   */
  getStatus(): LLMProviderStatus {
    return { ...this.status };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LLMProviderConfig {
    return { ...this.config };
  }

  /**
   * プロバイダータイプを取得
   */
  getType(): LLMProviderType {
    return this.type;
  }

  /**
   * 初期化状態を確認
   */
  isProviderInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 利用可能状態を確認
   */
  isProviderAvailable(): boolean {
    return this.status.isAvailable;
  }

  /**
   * 使用量統計をリセット
   */
  resetUsage(): void {
    this.status.usage = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
    };
    this.emit('usageReset');
  }

  /**
   * 使用量統計を取得
   */
  getUsage(): LLMProviderStatus['usage'] {
    return this.status.usage ? { ...this.status.usage } : undefined;
  }

  /**
   * 使用量統計を更新
   */
  protected updateUsage(usage: LLMResponse['usage'], cost?: number): void {
    if (this.status.usage && usage) {
      this.status.usage.totalRequests++;
      this.status.usage.totalTokens += usage.totalTokens;
      if (cost) {
        this.status.usage.totalCost += cost;
      }
    }
  }

  /**
   * エラーを処理
   */
  protected handleError(error: Error, operation: string): void {
    this.status.lastError = `${operation}: ${error.message}`;
    this.status.isAvailable = false;
    this.emit('error', { error, operation, provider: this.type });
  }

  /**
   * クリーンアップ
   */
  abstract cleanup(): Promise<void>;
} 

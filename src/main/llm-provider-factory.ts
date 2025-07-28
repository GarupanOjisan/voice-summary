import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderInfo,
} from './llm-provider';

export interface LLMProviderFactory {
  createProvider(type: LLMProviderType, config?: LLMProviderConfig): LLMProvider;
  getProviderInfo(type: LLMProviderType): LLMProviderInfo;
  getSupportedProviders(): LLMProviderType[];
}

export class LLMProviderFactoryImpl implements LLMProviderFactory {
  private providerInfos: Map<LLMProviderType, LLMProviderInfo> = new Map();

  constructor() {
    this.initializeProviderInfos();
  }

  /**
   * プロバイダー情報を初期化
   */
  private initializeProviderInfos(): void {
    // OpenAI プロバイダー情報
    this.providerInfos.set(LLMProviderType.OPENAI, {
      type: LLMProviderType.OPENAI,
      name: 'OpenAI GPT',
      description: 'OpenAI GPT-4o APIを使用した高精度な要約・分析',
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      maxTokens: 4096,
      supportsStreaming: true,
      requiresApiKey: true,
      isLocal: false,
      costPer1kTokens: {
        input: 0.005, // GPT-4o input cost per 1K tokens
        output: 0.015, // GPT-4o output cost per 1K tokens
      },
    });

    // Google Gemini プロバイダー情報
    this.providerInfos.set(LLMProviderType.GEMINI, {
      type: LLMProviderType.GEMINI,
      name: 'Google Gemini',
      description: 'Google Gemini 1.5 Pro APIを使用した高性能な要約・分析',
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      maxTokens: 8192,
      supportsStreaming: true,
      requiresApiKey: true,
      isLocal: false,
      costPer1kTokens: {
        input: 0.00375, // Gemini 1.5 Pro input cost per 1K tokens
        output: 0.015, // Gemini 1.5 Pro output cost per 1K tokens
      },
    });

    // Local Llama プロバイダー情報
    this.providerInfos.set(LLMProviderType.LOCAL_LLAMA, {
      type: LLMProviderType.LOCAL_LLAMA,
      name: 'Local Llama 3',
      description: 'ローカルで動作するLlama 3 70Bモデル（オフライン対応）',
      supportedModels: ['llama-3-70b', 'llama-3-8b', 'llama-3-1b'],
      maxTokens: 4096,
      supportsStreaming: false,
      requiresApiKey: false,
      isLocal: true,
      costPer1kTokens: {
        input: 0, // ローカルモデルは無料
        output: 0,
      },
    });
  }

  /**
   * プロバイダーインスタンスを作成
   */
  createProvider(type: LLMProviderType, config?: LLMProviderConfig): LLMProvider {
    switch (type) {
      case LLMProviderType.OPENAI:
        return this.createOpenAIProvider(config);
      case LLMProviderType.GEMINI:
        return this.createGeminiProvider(config);
      case LLMProviderType.LOCAL_LLAMA:
        return this.createLocalLlamaProvider(config);
      default:
        throw new Error(`サポートされていないLLMプロバイダータイプ: ${type}`);
    }
  }

  /**
   * OpenAI プロバイダーを作成
   */
  private createOpenAIProvider(config?: LLMProviderConfig): LLMProvider {
    // 動的インポートでOpenAIプロバイダーを読み込み
    const { OpenAIProvider } = require('./providers/openai-provider');
    return new OpenAIProvider(config);
  }

  /**
   * Google Gemini プロバイダーを作成
   */
  private createGeminiProvider(config?: LLMProviderConfig): LLMProvider {
    // 動的インポートでGeminiプロバイダーを読み込み
    const { GeminiProvider } = require('./providers/gemini-provider');
    return new GeminiProvider(config);
  }

  /**
   * Local Llama プロバイダーを作成
   */
  private createLocalLlamaProvider(config?: LLMProviderConfig): LLMProvider {
    // 動的インポートでLocal Llamaプロバイダーを読み込み
    const { LocalLlamaProvider } = require('./providers/local-llama-provider');
    return new LocalLlamaProvider(config);
  }

  /**
   * プロバイダー情報を取得
   */
  getProviderInfo(type: LLMProviderType): LLMProviderInfo {
    const info = this.providerInfos.get(type);
    if (!info) {
      throw new Error(`プロバイダー情報が見つかりません: ${type}`);
    }
    return { ...info };
  }

  /**
   * サポートされているプロバイダーのリストを取得
   */
  getSupportedProviders(): LLMProviderType[] {
    return Array.from(this.providerInfos.keys());
  }

  /**
   * すべてのプロバイダー情報を取得
   */
  getAllProviderInfos(): LLMProviderInfo[] {
    return Array.from(this.providerInfos.values()).map(info => ({ ...info }));
  }

  /**
   * ローカルプロバイダーのみを取得
   */
  getLocalProviders(): LLMProviderType[] {
    return this.getSupportedProviders().filter(type => {
      const info = this.providerInfos.get(type);
      return info?.isLocal;
    });
  }

  /**
   * クラウドプロバイダーのみを取得
   */
  getCloudProviders(): LLMProviderType[] {
    return this.getSupportedProviders().filter(type => {
      const info = this.providerInfos.get(type);
      return !info?.isLocal;
    });
  }
} 

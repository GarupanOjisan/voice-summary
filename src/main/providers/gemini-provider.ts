import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderInfo,
  LLMRequest,
  LLMResponse,
  LLMSummaryRequest,
  LLMSummaryResponse,
} from '../llm-provider';

export class GeminiProvider extends LLMProvider {
  private client: GoogleGenerativeAI | null = null;
  private model: any = null;
  private defaultModel = 'gemini-1.5-pro';

  constructor(config: LLMProviderConfig = {}) {
    super(LLMProviderType.GEMINI, config);
  }

  /**
   * プロバイダーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        throw new Error('Google Gemini APIキーが設定されていません');
      }

      this.client = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.client.getGenerativeModel({
        model: this.config.model || this.defaultModel,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      });

      // APIキーの有効性をテスト
      const result = await this.model.generateContent('Hello');
      await result.response;
      
      this.isInitialized = true;
      this.status.isAvailable = true;
      this.status.model = this.config.model || this.defaultModel;
      
      this.emit('initialized');
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'initialize');
      return false;
    }
  }

  /**
   * プロバイダー情報を取得
   */
  getProviderInfo(): LLMProviderInfo {
    return {
      type: LLMProviderType.GEMINI,
      name: 'Google Gemini',
      description: 'Google Gemini 1.5 Pro APIを使用した高性能な要約・分析',
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      maxTokens: 8192,
      supportsStreaming: true,
      requiresApiKey: true,
      isLocal: false,
      costPer1kTokens: {
        input: 0.00375,
        output: 0.015,
      },
    };
  }

  /**
   * テキスト生成を実行
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.model || !this.isInitialized) {
      throw new Error('Geminiプロバイダーが初期化されていません');
    }

    const startTime = Date.now();
    
    try {
      let prompt = request.prompt;
      
      // システムプロンプトがある場合は、プロンプトに組み込む
      if (request.systemPrompt) {
        prompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const llmResponse: LLMResponse = {
        text,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: (response.usageMetadata?.promptTokenCount || 0) + 
                      (response.usageMetadata?.candidatesTokenCount || 0),
        },
        model: this.config.model || this.defaultModel,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        latency: Date.now() - startTime,
      };

      // 使用量統計を更新
      if (llmResponse.usage) {
        const cost = this.calculateCost(llmResponse.usage);
        this.updateUsage(llmResponse.usage, cost);
      }

      this.emit('textGenerated', llmResponse);
      return llmResponse;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'generateText');
      throw error;
    }
  }

  /**
   * 要約を生成
   */
  async generateSummary(request: LLMSummaryRequest): Promise<LLMSummaryResponse> {
    const prompt = this.createSummaryPrompt(request);
    
    try {
      const response = await this.generateText({
        prompt,
        temperature: 0.3, // 要約は低い温度で一貫性を保つ
        maxTokens: request.maxLength || 500,
      });

      const summaryResponse: LLMSummaryResponse = {
        summary: response.text,
        usage: response.usage,
      };

      // 要約タイプに応じて追加情報を抽出
      if (request.summaryType === 'topics') {
        summaryResponse.topics = this.extractTopics(response.text);
      } else if (request.summaryType === 'action_items') {
        summaryResponse.actionItems = this.extractActionItems(response.text);
      }

      this.emit('summaryGenerated', summaryResponse);
      return summaryResponse;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'generateSummary');
      throw error;
    }
  }

  /**
   * ストリーミングテキスト生成を実行
   */
  async *generateTextStream(request: LLMRequest): AsyncGenerator<string> {
    if (!this.model || !this.isInitialized) {
      throw new Error('Geminiプロバイダーが初期化されていません');
    }

    try {
      let prompt = request.prompt;
      
      // システムプロンプトがある場合は、プロンプトに組み込む
      if (request.systemPrompt) {
        prompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      const result = await this.model.generateContentStream(prompt);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'generateTextStream');
      throw error;
    }
  }

  /**
   * 要約用プロンプトを作成
   */
  private createSummaryPrompt(request: LLMSummaryRequest): string {
    const { transcript, summaryType, language = 'ja' } = request;
    
    const basePrompt = `以下の会議の文字起こしを${language}で${this.getSummaryTypeDescription(summaryType)}してください：

文字起こし：
${transcript}

${this.getSummaryTypeDescription(summaryType)}：`;

    return basePrompt;
  }

  /**
   * 要約タイプの説明を取得
   */
  private getSummaryTypeDescription(summaryType: string): string {
    switch (summaryType) {
      case 'summary':
        return '簡潔に要約';
      case 'topics':
        return '主要なトピックを箇条書きで抽出';
      case 'action_items':
        return 'アクションアイテムを箇条書きで抽出';
      default:
        return '要約';
    }
  }

  /**
   * トピックを抽出
   */
  private extractTopics(text: string): string[] {
    // 箇条書きや番号付きリストからトピックを抽出
    const lines = text.split('\n').filter(line => line.trim());
    return lines
      .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(topic => topic.length > 0);
  }

  /**
   * アクションアイテムを抽出
   */
  private extractActionItems(text: string): string[] {
    // 箇条書きや番号付きリストからアクションアイテムを抽出
    const lines = text.split('\n').filter(line => line.trim());
    return lines
      .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(item => item.length > 0);
  }

  /**
   * コストを計算
   */
  private calculateCost(usage: LLMResponse['usage']): number {
    if (!usage) return 0;
    
    const inputCost = (usage.promptTokens / 1000) * 0.00375;
    const outputCost = (usage.completionTokens / 1000) * 0.015;
    
    return inputCost + outputCost;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    this.client = null;
    this.model = null;
    this.isInitialized = false;
    this.status.isAvailable = false;
    this.emit('cleanup');
  }
} 

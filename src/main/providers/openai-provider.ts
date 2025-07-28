import OpenAI from 'openai';
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

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI | null = null;
  private defaultModel = 'gpt-4o';

  constructor(config: LLMProviderConfig = {}) {
    super(LLMProviderType.OPENAI, config);
  }

  /**
   * プロバイダーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenAI APIキーが設定されていません');
      }

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
      });

      // APIキーの有効性をテスト
      await this.client.models.list();
      
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
      type: LLMProviderType.OPENAI,
      name: 'OpenAI GPT',
      description: 'OpenAI GPT-4o APIを使用した高精度な要約・分析',
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      maxTokens: 4096,
      supportsStreaming: true,
      requiresApiKey: true,
      isLocal: false,
      costPer1kTokens: {
        input: 0.005,
        output: 0.015,
      },
    };
  }

  /**
   * テキスト生成を実行
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client || !this.isInitialized) {
      throw new Error('OpenAIプロバイダーが初期化されていません');
    }

    const startTime = Date.now();
    
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      messages.push({ role: 'user', content: request.prompt });

      const completion = await this.client.chat.completions.create({
        model: this.config.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        stream: false,
      });

      const response: LLMResponse = {
        text: completion.choices[0]?.message?.content || '',
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        model: completion.model,
        finishReason: completion.choices[0]?.finish_reason,
        latency: Date.now() - startTime,
      };

      // 使用量統計を更新
      if (response.usage) {
        const cost = this.calculateCost(response.usage);
        this.updateUsage(response.usage, cost);
      }

      this.emit('textGenerated', response);
      return response;
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
        systemPrompt: this.getSystemPrompt(request.summaryType),
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
    if (!this.client || !this.isInitialized) {
      throw new Error('OpenAIプロバイダーが初期化されていません');
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      messages.push({ role: 'user', content: request.prompt });

      const stream = await this.client.chat.completions.create({
        model: this.config.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
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
   * システムプロンプトを取得
   */
  private getSystemPrompt(summaryType: string): string {
    switch (summaryType) {
      case 'summary':
        return 'あなたは会議の要約を専門とするアシスタントです。重要なポイントを簡潔にまとめてください。';
      case 'topics':
        return 'あなたは会議のトピック抽出を専門とするアシスタントです。議論された主要なトピックを箇条書きで抽出してください。';
      case 'action_items':
        return 'あなたは会議のアクションアイテム抽出を専門とするアシスタントです。決定されたアクションアイテムを箇条書きで抽出してください。';
      default:
        return 'あなたは会議の分析を専門とするアシスタントです。';
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
    
    const inputCost = (usage.promptTokens / 1000) * 0.005;
    const outputCost = (usage.completionTokens / 1000) * 0.015;
    
    return inputCost + outputCost;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    this.client = null;
    this.isInitialized = false;
    this.status.isAvailable = false;
    this.emit('cleanup');
  }
} 

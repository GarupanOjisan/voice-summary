import * as fs from 'fs';
import * as path from 'path';
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

export interface LocalLlamaConfig extends LLMProviderConfig {
  modelPath?: string;
  modelName?: string;
  contextLength?: number;
  threads?: number;
  gpuLayers?: number;
}

export class LocalLlamaProvider extends LLMProvider {
  private modelPath: string;
  private modelName: string;
  private contextLength: number;
  private threads: number;
  private gpuLayers: number;
  private isModelLoaded = false;
  private defaultModelPath = path.join(process.cwd(), 'models');

  constructor(config: LocalLlamaConfig = {}) {
    super(LLMProviderType.LOCAL_LLAMA, config);
    
    this.modelPath = config.modelPath || this.defaultModelPath;
    this.modelName = config.modelName || 'llama-3-8b.gguf';
    this.contextLength = config.contextLength || 4096;
    this.threads = config.threads || 4;
    this.gpuLayers = config.gpuLayers || 0;
  }

  /**
   * プロバイダーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      // モデルファイルの存在確認
      const fullModelPath = path.join(this.modelPath, this.modelName);
      if (!fs.existsSync(fullModelPath)) {
        throw new Error(`モデルファイルが見つかりません: ${fullModelPath}`);
      }

      // モデルの読み込み（実際の実装ではllama-cpp-nodeを使用）
      await this.loadModel();
      
      this.isInitialized = true;
      this.status.isAvailable = true;
      this.status.model = this.modelName;
      
      this.emit('initialized');
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'initialize');
      return false;
    }
  }

  /**
   * モデルを読み込み
   */
  private async loadModel(): Promise<void> {
    // 実際の実装ではllama-cpp-nodeを使用
    // ここでは簡易的な実装として、ファイルの存在確認のみ
    const fullModelPath = path.join(this.modelPath, this.modelName);
    
    if (!fs.existsSync(fullModelPath)) {
      throw new Error(`モデルファイルが見つかりません: ${fullModelPath}`);
    }

    // モデルファイルのサイズ確認
    const stats = fs.statSync(fullModelPath);
    if (stats.size < 1024 * 1024) { // 1MB未満は無効なモデルファイル
      throw new Error('無効なモデルファイルです');
    }

    this.isModelLoaded = true;
    console.log(`Local Llama モデルを読み込みました: ${this.modelName}`);
  }

  /**
   * プロバイダー情報を取得
   */
  getProviderInfo(): LLMProviderInfo {
    return {
      type: LLMProviderType.LOCAL_LLAMA,
      name: 'Local Llama 3',
      description: 'ローカルで動作するLlama 3 70Bモデル（オフライン対応）',
      supportedModels: ['llama-3-70b', 'llama-3-8b', 'llama-3-1b'],
      maxTokens: this.contextLength,
      supportsStreaming: false,
      requiresApiKey: false,
      isLocal: true,
      costPer1kTokens: {
        input: 0,
        output: 0,
      },
    };
  }

  /**
   * テキスト生成を実行
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.isModelLoaded || !this.isInitialized) {
      throw new Error('Local Llamaプロバイダーが初期化されていません');
    }

    const startTime = Date.now();
    
    try {
      // 実際の実装ではllama-cpp-nodeを使用
      // ここでは簡易的な実装として、モックレスポンスを返す
      const prompt = this.buildPrompt(request);
      const mockResponse = await this.generateMockResponse(prompt, request);

      const response: LLMResponse = {
        text: mockResponse.text,
        usage: {
          promptTokens: this.estimateTokens(prompt),
          completionTokens: this.estimateTokens(mockResponse.text),
          totalTokens: this.estimateTokens(prompt) + this.estimateTokens(mockResponse.text),
        },
        model: this.modelName,
        finishReason: 'STOP',
        latency: Date.now() - startTime,
      };

      // 使用量統計を更新（ローカルモデルはコスト0）
      if (response.usage) {
        this.updateUsage(response.usage, 0);
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
   * ストリーミングテキスト生成を実行（Local Llamaは非対応）
   */
  async *generateTextStream(request: LLMRequest): AsyncGenerator<string> {
    throw new Error('Local Llamaプロバイダーはストリーミングをサポートしていません');
  }

  /**
   * プロンプトを構築
   */
  private buildPrompt(request: LLMRequest): string {
    let prompt = '';
    
    if (request.systemPrompt) {
      prompt += `<|system|>\n${request.systemPrompt}\n<|end|>\n`;
    }
    
    prompt += `<|user|>\n${request.prompt}\n<|end|>\n<|assistant|>\n`;
    
    return prompt;
  }

  /**
   * モックレスポンスを生成（実際の実装ではllama-cpp-nodeを使用）
   */
  private async generateMockResponse(prompt: string, request: LLMRequest): Promise<{ text: string }> {
    // 実際の実装ではllama-cpp-nodeを使用してモデルを実行
    // ここでは簡易的なモックレスポンスを返す
    
    const mockResponses = {
      summary: 'これは会議の要約です。重要なポイントが議論され、決定事項が確認されました。',
      topics: '• プロジェクト計画\n• 技術的な課題\n• スケジュール調整\n• リソース配分',
      action_items: '• 技術仕様書の作成\n• チーム会議のスケジュール\n• 予算の見直し\n• 外部ベンダーとの連絡',
      default: 'Local Llama 3モデルからの応答です。実際の実装ではllama-cpp-nodeを使用してモデルを実行します。'
    };

    // プロンプトの内容に基づいて適切なレスポンスを選択
    if (prompt.includes('要約')) {
      return { text: mockResponses.summary };
    } else if (prompt.includes('トピック')) {
      return { text: mockResponses.topics };
    } else if (prompt.includes('アクション')) {
      return { text: mockResponses.action_items };
    } else {
      return { text: mockResponses.default };
    }
  }

  /**
   * トークン数を推定
   */
  private estimateTokens(text: string): number {
    // 簡易的なトークン数推定（実際の実装では適切なトークナイザーを使用）
    return Math.ceil(text.length / 4);
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
   * モデルファイルの一覧を取得
   */
  getAvailableModels(): string[] {
    try {
      if (!fs.existsSync(this.modelPath)) {
        return [];
      }
      
      const files = fs.readdirSync(this.modelPath);
      return files.filter(file => file.endsWith('.gguf'));
    } catch (error) {
      console.error('モデルファイル一覧の取得に失敗:', error);
      return [];
    }
  }

  /**
   * モデルファイルのダウンロード状況を確認
   */
  async checkModelDownloadStatus(): Promise<{
    isDownloaded: boolean;
    fileSize?: number;
    downloadProgress?: number;
  }> {
    const fullModelPath = path.join(this.modelPath, this.modelName);
    
    try {
      if (fs.existsSync(fullModelPath)) {
        const stats = fs.statSync(fullModelPath);
        return {
          isDownloaded: true,
          fileSize: stats.size,
        };
      } else {
        return {
          isDownloaded: false,
        };
      }
    } catch (error) {
      return {
        isDownloaded: false,
      };
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    this.isModelLoaded = false;
    this.isInitialized = false;
    this.status.isAvailable = false;
    this.emit('cleanup');
  }
} 

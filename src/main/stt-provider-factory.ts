import {
  STTProvider,
  STTProviderConfig,
  STTProviderType,
  STTProviderFactory as ISTTProviderFactory,
} from './stt-provider';
import { AssemblyAIProvider } from './providers/assemblyai-provider';
import { DeepgramProvider } from './providers/deepgram-provider';
import { GoogleSTTProvider } from './providers/google-stt-provider';
import { WhisperManager } from './whisper-manager';

export class STTProviderFactory implements ISTTProviderFactory {
  createProvider(type: STTProviderType, config: STTProviderConfig): STTProvider {
    switch (type) {
      case STTProviderType.ASSEMBLY_AI:
        return new AssemblyAIProvider(config);
      
      case STTProviderType.DEEPGRAM:
        return new DeepgramProvider(config);
      
      case STTProviderType.GOOGLE_STT:
        return new GoogleSTTProvider(config);
      
      case STTProviderType.WHISPER_LOCAL:
        // WhisperManagerをSTTProviderとしてラップ
        return new WhisperLocalProvider(config);
      
      default:
        throw new Error(`サポートされていないSTTプロバイダー: ${type}`);
    }
  }

  getSupportedProviders(): STTProviderType[] {
    return [
      STTProviderType.ASSEMBLY_AI,
      STTProviderType.DEEPGRAM,
      STTProviderType.GOOGLE_STT,
      STTProviderType.WHISPER_LOCAL,
    ];
  }

  getProviderInfo(type: STTProviderType): {
    name: string;
    description: string;
    features: string[];
    pricing: string;
    supportedLanguages: string[];
    supportedModels: string[];
  } {
    switch (type) {
      case STTProviderType.ASSEMBLY_AI:
        return {
          name: 'AssemblyAI',
          description: '高精度な音声認識API。リアルタイムストリーミングとファイル処理に対応。',
          features: [
            'リアルタイムストリーミング',
            '高精度な音声認識',
            '話者分離',
            '感情分析',
            '自動句読点',
            'スマートフォーマット'
          ],
          pricing: '従量課金制（分単位）',
          supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru'],
          supportedModels: ['default']
        };

      case STTProviderType.DEEPGRAM:
        return {
          name: 'Deepgram',
          description: '高速で高精度な音声認識API。低レイテンシーを特徴とする。',
          features: [
            'リアルタイムストリーミング',
            '低レイテンシー',
            '高精度な音声認識',
            '話者分離',
            '自動句読点',
            'スマートフォーマット'
          ],
          pricing: '従量課金制（分単位）',
          supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru'],
          supportedModels: ['nova-2', 'nova', 'enhanced', 'base']
        };

      case STTProviderType.GOOGLE_STT:
        return {
          name: 'Google Speech-to-Text',
          description: 'Googleの音声認識技術を使用した高精度なAPI。',
          features: [
            'リアルタイムストリーミング',
            '高精度な音声認識',
            '話者分離',
            '自動句読点',
            '複数の音声モデル',
            '医療・電話対応'
          ],
          pricing: '従量課金制（分単位）',
          supportedLanguages: ['ja-JP', 'en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ko-KR'],
          supportedModels: ['default', 'latest_long', 'latest_short', 'command_and_search', 'phone_call', 'video']
        };

      case STTProviderType.WHISPER_LOCAL:
        return {
          name: 'Whisper Local',
          description: 'ローカルで動作するWhisper.cppベースの音声認識。',
          features: [
            'オフライン動作',
            'プライバシー保護',
            '無料利用',
            'カスタマイズ可能',
            '複数モデル対応'
          ],
          pricing: '無料（ローカル処理）',
          supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru'],
          supportedModels: ['tiny', 'base', 'small', 'medium', 'large']
        };

      default:
        throw new Error(`サポートされていないSTTプロバイダー: ${type}`);
    }
  }
}

// WhisperManagerをSTTProviderとしてラップするアダプタークラス
class WhisperLocalProvider extends STTProvider {
  private whisperManager: WhisperManager;

  constructor(config: STTProviderConfig) {
    super(config);
    this.whisperManager = new WhisperManager();
  }

  async initialize(): Promise<boolean> {
    try {
      const result = await this.whisperManager.initialize('base');
      return result.success;
    } catch (error) {
      console.error('Whisper Local初期化エラー:', error);
      return false;
    }
  }

  async startStreaming(options: any = {}): Promise<void> {
    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      this.isStreaming = true;
      this.emit('streamingStarted');
      console.log('Whisper Localストリーミングを開始しました');
    } catch (error) {
      console.error('Whisper Localストリーミング開始エラー:', error);
      throw error;
    }
  }

  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    try {
      this.isStreaming = false;
      this.emit('streamingStopped');
    } catch (error) {
      console.error('Whisper Localストリーミング停止エラー:', error);
      throw error;
    }
  }

  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.isStreaming) {
      throw new Error('ストリーミングが開始されていません');
    }

    try {
      // WhisperManagerのストリーミング機能を使用
      // 実際の実装では、音声データをバッファリングして処理
      console.log('Whisper Localに音声データを送信:', data.length, 'bytes');
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  async transcribeFile(filePath: string): Promise<any> {
    try {
      const result = await this.whisperManager.transcribeAudio(filePath);
      
      const transcriptionResult = {
        text: result.text,
        confidence: 0.8, // Whisperは信頼度を直接提供しないため仮の値
        language: result.language,
        isFinal: true,
        timestamp: Date.now(),
        segments: result.segments,
      };

      this.emit('transcriptionComplete', transcriptionResult);
      return transcriptionResult;
    } catch (error) {
      console.error('Whisper Localファイル文字起こしエラー:', error);
      throw error;
    }
  }

  getSupportedLanguages(): string[] {
    return [
      'ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru',
      'nl', 'pl', 'tr', 'ar', 'hi', 'th', 'vi', 'sv', 'da', 'no',
      'fi', 'hu', 'cs', 'ro', 'sk', 'sl', 'hr', 'bg', 'el', 'he'
    ];
  }

  getSupportedModels(): string[] {
    return ['tiny', 'base', 'small', 'medium', 'large'];
  }

  getProviderName(): string {
    return 'Whisper Local';
  }
} 

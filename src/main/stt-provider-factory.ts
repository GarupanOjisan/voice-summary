import {
  STTProvider,
  STTProviderConfig,
  STTProviderType,
  STTProviderFactory as ISTTProviderFactory,
  STTTranscriptionResult,
} from './stt-provider';
import { AssemblyAIProvider } from './providers/assemblyai-provider';
import { DeepgramProvider } from './providers/deepgram-provider';
import { GoogleSTTProvider } from './providers/google-stt-provider';
import { WhisperManager } from './whisper-manager';
import * as path from 'path';

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
  private audioBuffer: Buffer[] = [];

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
      // 音声データをバッファに追加
      this.audioBuffer.push(data);
      
      // バッファサイズをチェック（5秒分のデータがたまったら処理）
      const totalSize = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
      const targetSize = (this.config.sampleRate || 16000) * 5 * 2; // 5秒分の16bit音声データ
      
      if (totalSize >= targetSize) {
        await this.processAudioBuffer();
      }
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  private async processAudioBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0) {
      return;
    }

    try {
      // バッファデータを結合
      const audioData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // 一時ファイルに保存
      const tempFilePath = path.join(require('os').tmpdir(), `whisper_${Date.now()}.wav`);
      await this.saveAudioToFile(audioData, tempFilePath);

      // Whisperで文字起こし
      const result = await this.whisperManager.transcribeAudio(tempFilePath, {
        language: this.config.language || 'ja',
        temperature: 0,
        suppressBlank: true,
      });

      // 結果をイベントとして発行
      const transcriptionResult: STTTranscriptionResult = {
        text: result.text,
        confidence: 0.8, // 仮の信頼度
        language: result.language,
        isFinal: true,
        timestamp: Date.now(),
        segments: result.segments.map(segment => ({
          start: segment.start,
          end: segment.end,
          text: segment.text,
          confidence: segment.avgLogProb || 0.8,
        })),
      };

      this.emit('transcriptionResult', transcriptionResult);

      // 一時ファイルを削除
      require('fs').unlinkSync(tempFilePath);
    } catch (error) {
      console.error('音声バッファ処理エラー:', error);
    }
  }

  private async saveAudioToFile(audioData: Buffer, filePath: string): Promise<void> {
    // 簡単なWAVファイルヘッダーを作成
    const sampleRate = this.config.sampleRate || 16000;
    const channels = this.config.channels || 1;
    const bitsPerSample = 16;
    
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + audioData.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(audioData.length, 40);

    const wavData = Buffer.concat([header, audioData]);
    require('fs').writeFileSync(filePath, wavData);
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

import { STTProvider, STTProviderType, STTProviderConfig } from './stt-provider';
import { AssemblyAIProvider } from './providers/assemblyai-provider';
import { DeepgramProvider } from './providers/deepgram-provider';
import { GoogleSTTProvider } from './providers/google-stt-provider';
import { KotobaWhisperProvider } from './providers/kotoba-whisper-provider';
import { WhisperManager } from './whisper-manager';
import { STTTranscriptionResult } from './stt-provider';
import * as path from 'path';

export class STTProviderFactory {
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
      case STTProviderType.KOTOBA_WHISPER:
        return new KotobaWhisperProvider(config);
      default:
        throw new Error(`Unsupported STT provider type: ${type}`);
    }
  }

  getSupportedProviders(): STTProviderType[] {
    return [
      STTProviderType.ASSEMBLY_AI,
      STTProviderType.DEEPGRAM,
      STTProviderType.GOOGLE_STT,
      STTProviderType.WHISPER_LOCAL,
      STTProviderType.KOTOBA_WHISPER,
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

      case STTProviderType.KOTOBA_WHISPER:
        return {
          name: 'Kotoba Whisper v2.0',
          description: '日本語に特化した高性能なWhisperモデル。通常のWhisper large-v3よりも6.3倍高速で、日本語の文字起こし精度も優れています。',
          features: [
            '日本語特化モデル',
            '6.3倍高速処理',
            '高精度な日本語文字起こし',
            'オフライン動作',
            'プライバシー保護',
            '無料利用'
          ],
          pricing: '無料（ローカル処理）',
          supportedLanguages: ['ja', 'en'],
          supportedModels: ['kotoba-tech/kotoba-whisper-v2.0']
        };

      default:
        throw new Error(`Unsupported STT provider type: ${type}`);
    }
  }
}

// WhisperManagerをSTTProviderとしてラップするアダプタークラス
class WhisperLocalProvider extends STTProvider {
  private whisperManager: WhisperManager;
  private audioBuffer: Buffer[] = [];
  private tempDir: string;

  constructor(config: STTProviderConfig) {
    super(config);
    this.whisperManager = new WhisperManager();
    this.tempDir = require('os').tmpdir();
  }

  async initialize(): Promise<boolean> {
    try {
      await this.whisperManager.initialize();
      return true;
    } catch (error) {
      console.error('WhisperLocalProvider初期化エラー:', error);
      return false;
    }
  }

  async startStreaming(options: any = {}): Promise<void> {
    this.isStreaming = true;
    this.audioBuffer = [];
    this.emit('streamingStarted');
  }

  async stopStreaming(): Promise<void> {
    this.isStreaming = false;
    this.audioBuffer = [];
    this.emit('streamingStopped');
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
      const tempFilePath = path.join(this.tempDir, `whisper_${Date.now()}.wav`);
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
        segments: result.segments.map((segment: any) => ({
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
    try {
      // WAVファイルヘッダーを作成
      const sampleRate = this.config.sampleRate || 16000;
      const channels = this.config.channels || 1;
      const bitsPerSample = 16;
      
      const header = this.createWavHeader(audioData.length, sampleRate, channels, bitsPerSample);
      const wavData = Buffer.concat([header, audioData]);
      
      require('fs').writeFileSync(filePath, wavData);
    } catch (error) {
      console.error('音声ファイル保存エラー:', error);
      throw error;
    }
  }

  private createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // byte rate
    header.writeUInt16LE(channels * bitsPerSample / 8, 32); // block align
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
  }

  async transcribeFile(filePath: string): Promise<any> {
    try {
      const result = await this.whisperManager.transcribeAudio(filePath, {
        language: this.config.language || 'ja',
        temperature: 0,
        suppressBlank: true,
      });

      return {
        text: result.text,
        confidence: 0.8,
        language: result.language,
        isFinal: true,
        timestamp: Date.now(),
        segments: result.segments,
      };
    } catch (error) {
      console.error('ファイル文字起こしエラー:', error);
      throw error;
    }
  }

  getSupportedLanguages(): string[] {
    return ['ja', 'en'];
  }

  getSupportedModels(): string[] {
    return ['tiny', 'base', 'small', 'medium', 'large'];
  }

  getProviderName(): string {
    return 'Whisper Local';
  }
} 

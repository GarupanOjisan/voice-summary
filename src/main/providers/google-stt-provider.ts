import { SpeechClient } from '@google-cloud/speech';
import {
  STTProvider,
  STTProviderConfig,
  STTTranscriptionResult,
  STTStreamingOptions,
  STTSegment,
  STTProviderType,
} from '../stt-provider';

export class GoogleSTTProvider extends STTProvider {
  private speechClient: SpeechClient;
  private recognizeStream: any = null;

  constructor(config: STTProviderConfig) {
    super(config);
    
    // Google Cloud認証情報の設定
    // 環境変数 GOOGLE_APPLICATION_CREDENTIALS でサービスアカウントキーファイルを指定
    this.speechClient = new SpeechClient({
      keyFilename: config.apiKey, // APIキーとしてサービスアカウントキーファイルのパスを使用
    });
  }

  async initialize(): Promise<boolean> {
    try {
      // クライアントの初期化をテスト
      await this.speechClient.initialize();
      return true;
    } catch (error) {
      console.error('Google STT初期化エラー:', error);
      return false;
    }
  }

  async startStreaming(options: STTStreamingOptions = {}): Promise<void> {
    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      const request = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: this.config.sampleRate || 16000,
          languageCode: options.language || 'ja-JP',
          model: options.model || 'default',
          useEnhanced: true,
          enableAutomaticPunctuation: options.punctuate || true,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          enableSpeakerDiarization: options.diarize || false,
          diarizationSpeakerCount: 2,
        },
        interimResults: options.interimResults || true,
      };

      this.recognizeStream = this.speechClient
        .streamingRecognize(request)
        .on('error', (error) => {
          console.error('Google STTストリーミングエラー:', error);
          this.emit('error', error);
        })
        .on('data', (data) => {
          this.handleStreamingResponse(data);
        })
        .on('end', () => {
          console.log('Google STTストリーミング終了');
          this.isStreaming = false;
          this.emit('streamingStopped');
        });

      this.isStreaming = true;
      this.emit('streamingStarted');
      console.log('Google STTストリーミングを開始しました');

    } catch (error) {
      console.error('Google STTストリーミング開始エラー:', error);
      throw error;
    }
  }

  async stopStreaming(): Promise<void> {
    if (!this.isStreaming || !this.recognizeStream) {
      return;
    }

    try {
      this.recognizeStream.end();
      this.recognizeStream = null;
      this.isStreaming = false;
      this.emit('streamingStopped');
    } catch (error) {
      console.error('Google STTストリーミング停止エラー:', error);
      throw error;
    }
  }

  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.isStreaming || !this.recognizeStream) {
      throw new Error('ストリーミングが開始されていません');
    }

    try {
      this.recognizeStream.write(data);
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  async transcribeFile(filePath: string): Promise<STTTranscriptionResult> {
    try {
      const fs = require('fs');
      const audioBytes = fs.readFileSync(filePath).toString('base64');

      const audio = {
        content: audioBytes,
      };

      const config = {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: this.config.sampleRate || 16000,
        languageCode: this.config.language || 'ja-JP',
        model: this.config.model || 'default',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        enableWordConfidence: true,
        enableSpeakerDiarization: false,
      };

      const request = {
        audio: audio,
        config: config,
      };

      const [response] = await this.speechClient.recognize(request as any);
      const transcription = response.results
        ?.map((result: any) => result.alternatives[0].transcript)
        .join('\n');

      const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0;

      // 単語レベルの情報を取得
      const words = response.results?.[0]?.alternatives?.[0]?.words || [];

      const result: STTTranscriptionResult = {
        text: transcription || '',
        confidence: confidence,
        language: this.config.language || 'ja-JP',
        isFinal: true,
        timestamp: Date.now(),
        segments: words.map((word: any) => ({
          start: word.startTime?.seconds || 0,
          end: word.endTime?.seconds || 0,
          text: word.word,
          confidence: word.confidence || 0,
        })),
      };

      this.emit('transcriptionComplete', result);
      return result;

    } catch (error) {
      console.error('Google STTファイル文字起こしエラー:', error);
      throw error;
    }
  }

  private handleStreamingResponse(data: any): void {
    const isFinal = data.results[0]?.isFinal || false;
    const transcription = data.results
      ?.map((result: any) => result.alternatives[0].transcript)
      .join('\n');

    if (transcription) {
      const confidence = data.results[0]?.alternatives[0]?.confidence || 0;
      const words = data.results[0]?.alternatives[0]?.words || [];

      const result: STTTranscriptionResult = {
        text: transcription,
        confidence: confidence,
        language: this.config.language || 'ja-JP',
        isFinal: isFinal,
        timestamp: Date.now(),
        segments: words.map((word: any) => ({
          start: word.startTime?.seconds || 0,
          end: word.endTime?.seconds || 0,
          text: word.word,
          confidence: word.confidence || 0,
        })),
      };

      this.emit('transcriptionResult', result);
    }
  }

  getSupportedLanguages(): string[] {
    return [
      'ja-JP', 'en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ko-KR', 'es-ES', 'es-MX',
      'fr-FR', 'fr-CA', 'de-DE', 'it-IT', 'pt-BR', 'pt-PT', 'ru-RU', 'nl-NL',
      'pl-PL', 'tr-TR', 'ar-SA', 'hi-IN', 'th-TH', 'vi-VN', 'sv-SE', 'da-DK',
      'no-NO', 'fi-FI', 'hu-HU', 'cs-CZ', 'ro-RO', 'sk-SK', 'sl-SI', 'hr-HR',
      'bg-BG', 'el-GR', 'he-IL'
    ];
  }

  getSupportedModels(): string[] {
    return ['default', 'latest_long', 'latest_short', 'command_and_search', 'phone_call', 'video', 'medical_dictation', 'medical_conversation'];
  }

  getProviderName(): string {
    return 'Google STT';
  }
} 

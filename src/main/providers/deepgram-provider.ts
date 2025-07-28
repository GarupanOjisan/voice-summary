import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import {
  STTProvider,
  STTProviderConfig,
  STTTranscriptionResult,
  STTStreamingOptions,
  STTSegment,
  STTProviderType,
} from '../stt-provider';

export class DeepgramProvider extends STTProvider {
  private apiClient: AxiosInstance;
  private websocket: WebSocket | null = null;
  private sessionId: string | null = null;

  constructor(config: STTProviderConfig) {
    super(config);
    this.apiClient = axios.create({
      baseURL: 'https://api.deepgram.com/v1',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(): Promise<boolean> {
    try {
      // APIキーの検証
      const response = await this.apiClient.get('/usage');
      return response.status === 200;
    } catch (error) {
      console.error('Deepgram初期化エラー:', error);
      return false;
    }
  }

  async startStreaming(options: STTStreamingOptions = {}): Promise<void> {
    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      // WebSocket接続を確立
      const params = new URLSearchParams({
        encoding: 'linear16',
        sample_rate: (this.config.sampleRate || 16000).toString(),
        channels: (this.config.channels || 1).toString(),
        language: options.language || 'ja',
        model: options.model || 'nova-2',
        interim_results: (options.interimResults || true).toString(),
        punctuate: (options.punctuate || true).toString(),
        profanity_filter: (options.profanityFilter || false).toString(),
        smart_format: (options.smartFormat || true).toString(),
        diarize: (options.diarize || false).toString(),
        speaker_labels: (options.speakerLabels || false).toString(),
      });

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      this.websocket = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${this.config.apiKey}`,
        },
      });

      this.websocket.on('open', () => {
        console.log('Deepgram WebSocket接続が確立されました');
        this.isStreaming = true;
        this.emit('streamingStarted');
      });

      this.websocket.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocketメッセージ解析エラー:', error);
        }
      });

      this.websocket.on('error', (error) => {
        console.error('Deepgram WebSocketエラー:', error);
        this.emit('error', error);
      });

      this.websocket.on('close', () => {
        console.log('Deepgram WebSocket接続が閉じられました');
        this.isStreaming = false;
        this.emit('streamingStopped');
      });

    } catch (error) {
      console.error('Deepgramストリーミング開始エラー:', error);
      throw error;
    }
  }

  async stopStreaming(): Promise<void> {
    if (!this.isStreaming || !this.websocket) {
      return;
    }

    try {
      this.websocket.close();
      this.websocket = null;
      this.isStreaming = false;
      this.emit('streamingStopped');
    } catch (error) {
      console.error('Deepgramストリーミング停止エラー:', error);
      throw error;
    }
  }

  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.isStreaming || !this.websocket) {
      throw new Error('ストリーミングが開始されていません');
    }

    try {
      // 音声データをそのまま送信
      this.websocket.send(data);
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  async transcribeFile(filePath: string): Promise<STTTranscriptionResult> {
    try {
      // ファイルを読み込み
      const fs = require('fs');
      const audioData = fs.readFileSync(filePath);

      // 文字起こしを実行
      const response = await this.apiClient.post('/listen', audioData, {
        headers: {
          'Content-Type': 'audio/wav',
        },
        params: {
          encoding: 'linear16',
          sample_rate: this.config.sampleRate || 16000,
          channels: this.config.channels || 1,
          language: this.config.language || 'ja',
          model: this.config.model || 'nova-2',
          punctuate: true,
          smart_format: true,
          diarize: false,
          speaker_labels: false,
        },
      });

      const result = response.data;

      // 結果を変換
      const transcriptionResult: STTTranscriptionResult = {
        text: result.results?.channels[0]?.alternatives[0]?.transcript || '',
        confidence: result.results?.channels[0]?.alternatives[0]?.confidence || 0,
        language: this.config.language || 'ja',
        isFinal: true,
        timestamp: Date.now(),
        segments: result.results?.channels[0]?.alternatives[0]?.words?.map((word: any) => ({
          start: word.start,
          end: word.end,
          text: word.word,
          confidence: word.confidence || 0,
          speaker: word.speaker,
        })) || [],
      };

      this.emit('transcriptionComplete', transcriptionResult);
      return transcriptionResult;

    } catch (error) {
      console.error('Deepgramファイル文字起こしエラー:', error);
      throw error;
    }
  }

  private handleWebSocketMessage(message: any): void {
    if (message.type === 'Results') {
      const channel = message.channel;
      const alternative = channel.alternatives[0];

      if (alternative) {
        const result: STTTranscriptionResult = {
          text: alternative.transcript,
          confidence: alternative.confidence || 0,
          language: this.config.language || 'ja',
          isFinal: !message.is_final,
          timestamp: Date.now(),
          segments: alternative.words?.map((word: any) => ({
            start: word.start,
            end: word.end,
            text: word.word,
            confidence: word.confidence || 0,
            speaker: word.speaker,
          })) || [],
        };

        this.emit('transcriptionResult', result);
      }
    } else if (message.type === 'Error') {
      console.error('Deepgramエラー:', message.error);
      this.emit('error', new Error(message.error));
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
    return ['nova-2', 'nova', 'enhanced', 'base'];
  }

  getProviderName(): string {
    return 'Deepgram';
  }
} 

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

export class AssemblyAIProvider extends STTProvider {
  private apiClient: AxiosInstance;
  private websocket: WebSocket | null = null;
  private sessionId: string | null = null;

  constructor(config: STTProviderConfig) {
    super(config);
    this.apiClient = axios.create({
      baseURL: 'https://api.assemblyai.com/v2',
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(): Promise<boolean> {
    try {
      // APIキーの検証
      const response = await this.apiClient.get('/transcript');
      return response.status === 200;
    } catch (error) {
      console.error('AssemblyAI初期化エラー:', error);
      return false;
    }
  }

  async startStreaming(options: STTStreamingOptions = {}): Promise<void> {
    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      // WebSocket接続を確立
      const wsUrl = 'wss://api.assemblyai.com/v2/realtime/ws';
      this.websocket = new WebSocket(wsUrl);

      this.websocket.on('open', () => {
        console.log('AssemblyAI WebSocket接続が確立されました');
        this.isStreaming = true;
        this.emit('streamingStarted');
        
        // 設定を送信
        const configMessage = {
          authorization: this.config.apiKey,
          sample_rate: this.config.sampleRate || 16000,
          language_code: options.language || 'ja',
          enable_interim_results: options.interimResults || true,
          enable_auto_punctuate: options.punctuate || true,
          enable_profanity_filter: options.profanityFilter || false,
          enable_smart_format: options.smartFormat || true,
          enable_diarization: options.diarize || false,
          speaker_labels: options.speakerLabels || false,
        };
        
        this.websocket?.send(JSON.stringify(configMessage));
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
        console.error('AssemblyAI WebSocketエラー:', error);
        this.emit('error', error);
      });

      this.websocket.on('close', () => {
        console.log('AssemblyAI WebSocket接続が閉じられました');
        this.isStreaming = false;
        this.emit('streamingStopped');
      });

    } catch (error) {
      console.error('AssemblyAIストリーミング開始エラー:', error);
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
      console.error('AssemblyAIストリーミング停止エラー:', error);
      throw error;
    }
  }

  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.isStreaming || !this.websocket) {
      throw new Error('ストリーミングが開始されていません');
    }

    try {
      // 音声データをBase64エンコードして送信
      const audioMessage = {
        audio_data: data.toString('base64'),
      };
      
      this.websocket.send(JSON.stringify(audioMessage));
    } catch (error) {
      console.error('音声データ送信エラー:', error);
      throw error;
    }
  }

  async transcribeFile(filePath: string): Promise<STTTranscriptionResult> {
    try {
      // ファイルをアップロード
      const uploadResponse = await this.apiClient.post('/upload', {
        file: filePath,
      });

      const uploadUrl = uploadResponse.data.upload_url;

      // 文字起こしを開始
      const transcriptResponse = await this.apiClient.post('/transcript', {
        audio_url: uploadUrl,
        language_code: this.config.language || 'ja',
        auto_punctuate: true,
        smart_format: true,
        diarization: false,
        speaker_labels: false,
      });

      const transcriptId = transcriptResponse.data.id;

      // 完了まで待機
      let transcript;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await this.apiClient.get(`/transcript/${transcriptId}`);
        transcript = statusResponse.data;
      } while (transcript.status !== 'completed' && transcript.status !== 'error');

      if (transcript.status === 'error') {
        throw new Error(`文字起こしエラー: ${transcript.error}`);
      }

      // 結果を変換
      const result: STTTranscriptionResult = {
        text: transcript.text,
        confidence: transcript.confidence || 0,
        language: transcript.language_code,
        isFinal: true,
        timestamp: Date.now(),
        segments: transcript.words?.map((word: any) => ({
          start: word.start / 1000, // ミリ秒を秒に変換
          end: word.end / 1000,
          text: word.text,
          confidence: word.confidence || 0,
        })) || [],
      };

      this.emit('transcriptionComplete', result);
      return result;

    } catch (error) {
      console.error('AssemblyAIファイル文字起こしエラー:', error);
      throw error;
    }
  }

  private handleWebSocketMessage(message: any): void {
    if (message.message_type === 'SessionBegins') {
      this.sessionId = message.session_id;
      console.log('AssemblyAIセッション開始:', this.sessionId);
    } else if (message.message_type === 'FinalTranscript') {
      const result: STTTranscriptionResult = {
        text: message.text,
        confidence: message.confidence || 0,
        language: this.config.language || 'ja',
        isFinal: true,
        timestamp: Date.now(),
        segments: message.words?.map((word: any) => ({
          start: word.start / 1000,
          end: word.end / 1000,
          text: word.text,
          confidence: word.confidence || 0,
        })) || [],
      };

      this.emit('transcriptionResult', result);
    } else if (message.message_type === 'PartialTranscript') {
      const result: STTTranscriptionResult = {
        text: message.text,
        confidence: message.confidence || 0,
        language: this.config.language || 'ja',
        isFinal: false,
        timestamp: Date.now(),
      };

      this.emit('transcriptionResult', result);
    } else if (message.message_type === 'SessionTerminated') {
      console.log('AssemblyAIセッション終了');
      this.emit('sessionTerminated');
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
    return ['default'];
  }

  getProviderName(): string {
    return 'AssemblyAI';
  }
} 

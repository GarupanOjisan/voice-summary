import { ipcMain } from 'electron';
import {
  AudioCapture,
  AudioDevice,
  AudioCaptureOptions,
} from './audio-capture';
import { AudioProcessor, AudioProcessorOptions } from './audio-processor';
import { VirtualAudioDeviceManager } from './virtual-audio-device';
import { WhisperManager } from './whisper-manager';
import {
  StreamingTranscription,
  StreamingTranscriptionOptions,
} from './streaming-transcription';
import { STTManager, STTManagerConfig } from './stt-manager';
import { STTProviderType } from './stt-provider';

export class AudioManager {
  private audioCapture: AudioCapture | null = null;
  private audioProcessor: AudioProcessor | null = null;
  private virtualAudioDeviceManager: VirtualAudioDeviceManager;
  private whisperManager: WhisperManager;
  private streamingTranscription: StreamingTranscription | null = null;
  private sttManager: STTManager;
  private devices: AudioDevice[] = [];

  constructor() {
    this.virtualAudioDeviceManager = new VirtualAudioDeviceManager();
    this.whisperManager = new WhisperManager();
    
    // STTマネージャーを初期化
    const sttConfig: STTManagerConfig = {
      defaultProvider: STTProviderType.WHISPER_LOCAL,
      providers: {
        [STTProviderType.WHISPER_LOCAL]: {
          apiKey: '', // Whisper LocalはAPIキー不要
          language: 'ja',
          sampleRate: 16000,
          channels: 1,
        },
        // 他のプロバイダーの設定は後で追加
      },
      autoSwitch: true,
      fallbackProvider: STTProviderType.WHISPER_LOCAL,
    };
    
    this.sttManager = new STTManager(sttConfig);
    this.setupIpcHandlers();
  }

  /**
   * IPCハンドラーを設定
   */
  private setupIpcHandlers(): void {
    // 音声デバイス取得
    ipcMain.handle('get-audio-devices', async () => {
      try {
        this.devices = await this.getAudioDevices();
        return this.devices;
      } catch (error) {
        console.error('音声デバイス取得エラー:', error);
        return [];
      }
    });

    // 音声キャプチャ開始
    ipcMain.handle('start-audio-capture', async (event, deviceId: string) => {
      try {
        await this.startCapture(deviceId);
        return { success: true };
      } catch (error) {
        console.error('音声キャプチャ開始エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 音声キャプチャ停止
    ipcMain.handle('stop-audio-capture', async () => {
      try {
        await this.stopCapture();
        return { success: true };
      } catch (error) {
        console.error('音声キャプチャ停止エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 音声品質統計取得
    ipcMain.handle('get-audio-quality-stats', () => {
      if (this.audioProcessor) {
        return this.audioProcessor.getAudioQualityStats();
      }
      return null;
    });

    // バッファ情報取得
    ipcMain.handle('get-buffer-info', () => {
      if (this.audioProcessor) {
        return this.audioProcessor.getBufferInfo();
      }
      return null;
    });

    // 音声処理設定更新
    ipcMain.handle(
      'update-audio-processor-options',
      (event, options: AudioProcessorOptions) => {
        if (this.audioProcessor) {
          this.audioProcessor.updateOptions(options);
          return { success: true };
        }
        return { success: false, error: 'AudioProcessor not initialized' };
      }
    );

    // 仮想オーディオデバイス設定取得
    ipcMain.handle('get-virtual-audio-device-config', async () => {
      try {
        return await this.virtualAudioDeviceManager.getVirtualDeviceConfiguration();
      } catch (error) {
        console.error('仮想オーディオデバイス設定取得エラー:', error);
        return { isInstalled: false, devices: [] };
      }
    });

    // 仮想オーディオデバイス作成
    ipcMain.handle('create-virtual-audio-device', async () => {
      try {
        return await this.virtualAudioDeviceManager.createVirtualDevice();
      } catch (error) {
        console.error('仮想オーディオデバイス作成エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 音声ルーティング設定取得
    ipcMain.handle('get-audio-routing-config', () => {
      return this.virtualAudioDeviceManager.getAudioMixingConfiguration();
    });

    // 音声ルーティング設定更新
    ipcMain.handle('update-audio-routing', async (event, config) => {
      try {
        return await this.virtualAudioDeviceManager.updateAudioRouting(config);
      } catch (error) {
        console.error('音声ルーティング設定更新エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 仮想オーディオデバイスからの音声キャプチャ開始
    ipcMain.handle(
      'start-virtual-audio-capture',
      async (event, deviceName: string) => {
        try {
          await this.startVirtualCapture(deviceName);
          return { success: true };
        } catch (error) {
          console.error('仮想オーディオデバイスキャプチャ開始エラー:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // 混合音声キャプチャ開始
    ipcMain.handle(
      'start-mixed-audio-capture',
      async (event, systemDevice: string, micDevice: string) => {
        try {
          await this.startMixedCapture(systemDevice, micDevice);
          return { success: true };
        } catch (error) {
          console.error('混合音声キャプチャ開始エラー:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Whisper関連のIPCハンドラー
    // 利用可能なモデル取得
    ipcMain.handle('get-whisper-models', () => {
      return this.whisperManager.getAvailableModels();
    });

    // ダウンロード済みモデル取得
    ipcMain.handle('get-downloaded-whisper-models', () => {
      return this.whisperManager.getDownloadedModels();
    });

    // モデルダウンロード
    ipcMain.handle(
      'download-whisper-model',
      async (event, modelName: string) => {
        try {
          return await this.whisperManager.downloadModel(modelName);
        } catch (error) {
          console.error('Whisperモデルダウンロードエラー:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Whisper初期化
    ipcMain.handle('initialize-whisper', async (event, modelName: string) => {
      try {
        return await this.whisperManager.initialize(modelName);
      } catch (error) {
        console.error('Whisper初期化エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // ストリーミング音声認識開始
    ipcMain.handle(
      'start-streaming-transcription',
      async (event, options: StreamingTranscriptionOptions) => {
        try {
          await this.startStreamingTranscription(options);
          return { success: true };
        } catch (error) {
          console.error('ストリーミング音声認識開始エラー:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // ストリーミング音声認識停止
    ipcMain.handle('stop-streaming-transcription', async () => {
      try {
        await this.stopStreamingTranscription();
        return { success: true };
      } catch (error) {
        console.error('ストリーミング音声認識停止エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Whisper設定取得
    ipcMain.handle('get-whisper-settings', () => {
      return this.whisperManager.getCurrentSettings();
    });

    // ストリーミング設定取得
    ipcMain.handle('get-streaming-transcription-info', () => {
      if (this.streamingTranscription) {
        return {
          options: this.streamingTranscription.getOptions(),
          bufferInfo: this.streamingTranscription.getBufferInfo(),
          isActive: this.streamingTranscription.isStreamingActive(),
        };
      }
      return null;
    });

    // STTマネージャー関連のIPCハンドラー
    // サポートされているプロバイダー取得
    ipcMain.handle('get-supported-stt-providers', () => {
      return this.sttManager.getSupportedProviders();
    });

    // プロバイダー情報取得
    ipcMain.handle('get-stt-provider-info', (event, providerType: STTProviderType) => {
      return this.sttManager.getProviderInfo(providerType);
    });

    // プロバイダー状態取得
    ipcMain.handle('get-stt-provider-status', () => {
      return this.sttManager.getProviderStatus();
    });

    // プロバイダー初期化
    ipcMain.handle('initialize-stt-provider', async (event, providerType: STTProviderType) => {
      try {
        const success = await this.sttManager.initializeProvider(providerType);
        return { success, error: success ? undefined : 'プロバイダーの初期化に失敗しました' };
      } catch (error) {
        console.error('STTプロバイダー初期化エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // プロバイダー切り替え
    ipcMain.handle('switch-stt-provider', async (event, providerType: STTProviderType) => {
      try {
        const success = await this.sttManager.switchToProvider(providerType);
        return { success, error: success ? undefined : 'プロバイダーの切り替えに失敗しました' };
      } catch (error) {
        console.error('STTプロバイダー切り替えエラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // STTストリーミング開始
    ipcMain.handle('start-stt-streaming', async (event, options: any) => {
      try {
        await this.sttManager.startStreaming(options);
        return { success: true };
      } catch (error) {
        console.error('STTストリーミング開始エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // STTストリーミング停止
    ipcMain.handle('stop-stt-streaming', async () => {
      try {
        await this.sttManager.stopStreaming();
        return { success: true };
      } catch (error) {
        console.error('STTストリーミング停止エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 現在のプロバイダー取得
    ipcMain.handle('get-current-stt-provider', () => {
      return this.sttManager.getCurrentProviderType();
    });

    // STT設定更新
    ipcMain.handle('update-stt-config', (event, config: Partial<STTManagerConfig>) => {
      try {
        this.sttManager.updateConfig(config);
        return { success: true };
      } catch (error) {
        console.error('STT設定更新エラー:', error);
        return { success: false, error: (error as Error).message };
      }
    });
  }

  /**
   * 音声デバイスを取得
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    if (!this.audioCapture) {
      this.audioCapture = new AudioCapture();
    }
    return await this.audioCapture.getAudioDevices();
  }

  /**
   * 音声キャプチャを開始
   */
  async startCapture(deviceId: string): Promise<void> {
    if (this.audioCapture && this.audioCapture.isCapturingAudio()) {
      await this.stopCapture();
    }

    const options: AudioCaptureOptions = {
      deviceId,
      sampleRate: 16000,
      channels: 1,
      bufferSize: 1024,
    };

    this.audioCapture = new AudioCapture(options);

    // AudioProcessorを初期化
    const processorOptions: AudioProcessorOptions = {
      bufferOptions: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        chunkDuration: 0.25, // 250ms
        maxBufferSize: 1024 * 1024, // 1MB
      },
      enableVUMeter: true,
      enableQualityAnalysis: true,
      silenceDetection: true,
    };

    this.audioProcessor = new AudioProcessor(processorOptions);

    // イベントリスナーを設定
    this.audioCapture.on('audioData', (data: Buffer) => {
      // AudioProcessorに音声データを送信
      if (this.audioProcessor) {
        this.audioProcessor.addAudioData(data);
      }
    });

    this.audioCapture.on('error', (error: Error) => {
      console.error('音声キャプチャエラー:', error);
    });

    // AudioProcessorのイベントリスナーを設定
    if (this.audioProcessor) {
      this.audioProcessor.on('processedChunk', (chunk) => {
        // レンダラープロセスに処理済みチャンクを送信
        this.sendProcessedChunkToRenderer(chunk);
      });

      this.audioProcessor.on('vuMeter', (data) => {
        // レンダラープロセスにVUメーターデータを送信
        this.sendVUMeterDataToRenderer(data);
      });

      this.audioProcessor.on('qualityMetrics', (metrics) => {
        // レンダラープロセスに品質メトリクスを送信
        this.sendQualityMetricsToRenderer(metrics);
      });

      this.audioProcessor.on('silenceDetected', (data) => {
        // レンダラープロセスに無音検出を送信
        this.sendSilenceDetectionToRenderer(data);
      });

      // AudioProcessorを開始
      this.audioProcessor.start();
    }

    await this.audioCapture.startCapture();
  }

  /**
   * 音声キャプチャを停止
   */
  async stopCapture(): Promise<void> {
    if (this.audioProcessor) {
      this.audioProcessor.stop();
      this.audioProcessor = null;
    }

    if (this.audioCapture) {
      await this.audioCapture.stopCapture();
      this.audioCapture = null;
    }
  }

  /**
   * レンダラープロセスに処理済みチャンクを送信
   */
  private sendProcessedChunkToRenderer(chunk: any): void {
    // メインプロセスからレンダラープロセスへの通信
    // 実際の実装では、WebContentsを使用して送信
    console.log('処理済みチャンク送信:', chunk.data.length, 'bytes');
  }

  /**
   * レンダラープロセスにVUメーターデータを送信
   */
  private sendVUMeterDataToRenderer(data: any): void {
    // メインプロセスからレンダラープロセスへの通信
    console.log('VUメーターデータ送信:', data.level, '%');
  }

  /**
   * レンダラープロセスに品質メトリクスを送信
   */
  private sendQualityMetricsToRenderer(metrics: any): void {
    // メインプロセスからレンダラープロセスへの通信
    console.log('品質メトリクス送信:', metrics.level, '%');
  }

  /**
   * レンダラープロセスに無音検出を送信
   */
  private sendSilenceDetectionToRenderer(data: any): void {
    // メインプロセスからレンダラープロセスへの通信
    console.log('無音検出送信:', data.timestamp);
  }

  /**
   * 音声レベルを取得
   */
  getAudioLevel(): number {
    if (this.audioProcessor) {
      return this.audioProcessor.getCurrentAudioLevel();
    }
    return 0;
  }

  /**
   * キャプチャ状態を取得
   */
  isCapturing(): boolean {
    return this.audioCapture ? this.audioCapture.isCapturingAudio() : false;
  }

  /**
   * 仮想オーディオデバイスからの音声キャプチャを開始
   */
  async startVirtualCapture(deviceName: string): Promise<void> {
    if (this.audioCapture && this.audioCapture.isCapturingAudio()) {
      await this.stopCapture();
    }

    const options: AudioCaptureOptions = {
      deviceId: deviceName,
      sampleRate: 16000,
      channels: 1,
      bufferSize: 1024,
    };

    this.audioCapture = new AudioCapture(options);

    // AudioProcessorを初期化
    const processorOptions: AudioProcessorOptions = {
      bufferOptions: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        chunkDuration: 0.25, // 250ms
        maxBufferSize: 1024 * 1024, // 1MB
      },
      enableVUMeter: true,
      enableQualityAnalysis: true,
      silenceDetection: true,
    };

    this.audioProcessor = new AudioProcessor(processorOptions);

    // イベントリスナーを設定
    this.audioCapture.on('audioData', (data: Buffer) => {
      if (this.audioProcessor) {
        this.audioProcessor.addAudioData(data);
      }
    });

    this.audioCapture.on('error', (error: Error) => {
      console.error('仮想オーディオデバイスキャプチャエラー:', error);
    });

    // AudioProcessorのイベントリスナーを設定
    if (this.audioProcessor) {
      this.audioProcessor.on('processedChunk', (chunk) => {
        this.sendProcessedChunkToRenderer(chunk);
      });

      this.audioProcessor.on('vuMeter', (data) => {
        this.sendVUMeterDataToRenderer(data);
      });

      this.audioProcessor.on('qualityMetrics', (metrics) => {
        this.sendQualityMetricsToRenderer(metrics);
      });

      this.audioProcessor.on('silenceDetected', (data) => {
        this.sendSilenceDetectionToRenderer(data);
      });

      this.audioProcessor.start();
    }

    await this.audioCapture.startVirtualAudioCapture(deviceName);
  }

  /**
   * システム音声とマイク音声の混合キャプチャを開始
   */
  async startMixedCapture(
    systemDevice: string,
    micDevice: string
  ): Promise<void> {
    if (this.audioCapture && this.audioCapture.isCapturingAudio()) {
      await this.stopCapture();
    }

    const options: AudioCaptureOptions = {
      deviceId: `${systemDevice}+${micDevice}`,
      sampleRate: 16000,
      channels: 1,
      bufferSize: 1024,
    };

    this.audioCapture = new AudioCapture(options);

    // AudioProcessorを初期化
    const processorOptions: AudioProcessorOptions = {
      bufferOptions: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        chunkDuration: 0.25, // 250ms
        maxBufferSize: 1024 * 1024, // 1MB
      },
      enableVUMeter: true,
      enableQualityAnalysis: true,
      silenceDetection: true,
    };

    this.audioProcessor = new AudioProcessor(processorOptions);

    // イベントリスナーを設定
    this.audioCapture.on('audioData', (data: Buffer) => {
      if (this.audioProcessor) {
        this.audioProcessor.addAudioData(data);
      }
    });

    this.audioCapture.on('error', (error: Error) => {
      console.error('混合音声キャプチャエラー:', error);
    });

    // AudioProcessorのイベントリスナーを設定
    if (this.audioProcessor) {
      this.audioProcessor.on('processedChunk', (chunk) => {
        this.sendProcessedChunkToRenderer(chunk);
      });

      this.audioProcessor.on('vuMeter', (data) => {
        this.sendVUMeterDataToRenderer(data);
      });

      this.audioProcessor.on('qualityMetrics', (metrics) => {
        this.sendQualityMetricsToRenderer(metrics);
      });

      this.audioProcessor.on('silenceDetected', (data) => {
        this.sendSilenceDetectionToRenderer(data);
      });

      this.audioProcessor.start();
    }

    await this.audioCapture.startMixedAudioCapture(systemDevice, micDevice);
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreamingTranscription(
    options: StreamingTranscriptionOptions
  ): Promise<void> {
    if (
      this.streamingTranscription &&
      this.streamingTranscription.isStreamingActive()
    ) {
      await this.stopStreamingTranscription();
    }

    // StreamingTranscriptionを初期化
    this.streamingTranscription = new StreamingTranscription(
      this.whisperManager,
      options
    );

    // イベントリスナーを設定
    this.streamingTranscription.on('transcriptionChunk', (chunk) => {
      this.sendTranscriptionChunkToRenderer(chunk);
    });

    this.streamingTranscription.on('error', (error) => {
      console.error('ストリーミング音声認識エラー:', error);
    });

    this.streamingTranscription.on('streamingStarted', () => {
      console.log('ストリーミング音声認識が開始されました');
    });

    this.streamingTranscription.on('streamingStopped', () => {
      console.log('ストリーミング音声認識が停止されました');
    });

    // AudioProcessorから音声データを受け取ってストリーミングに送信
    if (this.audioProcessor) {
      this.audioProcessor.on('processedChunk', (chunk) => {
        if (this.streamingTranscription) {
          this.streamingTranscription.addAudioData(chunk.data);
        }
      });
    }

    await this.streamingTranscription.startStreaming();
  }

  /**
   * ストリーミング音声認識を停止
   */
  async stopStreamingTranscription(): Promise<void> {
    if (this.streamingTranscription) {
      await this.streamingTranscription.stopStreaming();
      this.streamingTranscription.cleanup();
      this.streamingTranscription = null;
    }
  }

  /**
   * レンダラープロセスに文字起こしチャンクを送信
   */
  private sendTranscriptionChunkToRenderer(chunk: any): void {
    // メインプロセスからレンダラープロセスへの通信
    console.log('文字起こしチャンク送信:', chunk.text);
  }
}

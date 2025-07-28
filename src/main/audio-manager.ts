import { ipcMain } from 'electron';
import {
  AudioCapture,
  AudioDevice,
  AudioCaptureOptions,
} from './audio-capture';
import { AudioProcessor, AudioProcessorOptions } from './audio-processor';
import { VirtualAudioDeviceManager } from './virtual-audio-device';

export class AudioManager {
  private audioCapture: AudioCapture | null = null;
  private audioProcessor: AudioProcessor | null = null;
  private virtualAudioDeviceManager: VirtualAudioDeviceManager;
  private devices: AudioDevice[] = [];

  constructor() {
    this.virtualAudioDeviceManager = new VirtualAudioDeviceManager();
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
}

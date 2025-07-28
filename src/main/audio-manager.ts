import { ipcMain } from 'electron';
import {
  AudioCapture,
  AudioDevice,
  AudioCaptureOptions,
} from './audio-capture';

export class AudioManager {
  private audioCapture: AudioCapture | null = null;
  private devices: AudioDevice[] = [];

  constructor() {
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

    // イベントリスナーを設定
    this.audioCapture.on('audioData', (data: Buffer) => {
      // レンダラープロセスに音声データを送信
      this.sendAudioDataToRenderer(data);
    });

    this.audioCapture.on('error', (error: Error) => {
      console.error('音声キャプチャエラー:', error);
    });

    await this.audioCapture.startCapture();
  }

  /**
   * 音声キャプチャを停止
   */
  async stopCapture(): Promise<void> {
    if (this.audioCapture) {
      await this.audioCapture.stopCapture();
      this.audioCapture = null;
    }
  }

  /**
   * レンダラープロセスに音声データを送信
   */
  private sendAudioDataToRenderer(data: Buffer): void {
    // メインプロセスからレンダラープロセスへの通信
    // 実際の実装では、WebContentsを使用して送信
    console.log('音声データ受信:', data.length, 'bytes');
  }

  /**
   * 音声レベルを取得
   */
  getAudioLevel(): number {
    if (this.audioCapture) {
      return this.audioCapture.getAudioLevel();
    }
    return 0;
  }

  /**
   * キャプチャ状態を取得
   */
  isCapturing(): boolean {
    return this.audioCapture ? this.audioCapture.isCapturingAudio() : false;
  }
}

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
}

export interface AudioCaptureOptions {
  deviceId?: string;
  sampleRate?: number;
  channels?: number;
  bufferSize?: number;
}

export class AudioCapture extends EventEmitter {
  private isCapturing = false;
  private captureProcess: any = null;
  private options: AudioCaptureOptions;

  constructor(options: AudioCaptureOptions = {}) {
    super();
    this.options = {
      sampleRate: 16000,
      channels: 1,
      bufferSize: 1024,
      ...options,
    };
  }

  /**
   * 利用可能な音声デバイスを取得
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      // macOS CoreAudioデバイス情報を取得
      const { stdout } = await execAsync(
        'system_profiler SPAudioDataType -json'
      );
      const audioData = JSON.parse(stdout);

      const devices: AudioDevice[] = [];

      if (audioData.SPAudioDataType) {
        for (const device of audioData.SPAudioDataType) {
          if (device._name) {
            devices.push({
              id: device._name,
              name: device._name,
              type: 'input', // 簡易実装のためinputとして扱う
              isDefault: false,
            });
          }
        }
      }

      return devices;
    } catch (error) {
      console.error('音声デバイス取得エラー:', error);
      return [];
    }
  }

  /**
   * 音声キャプチャを開始
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      throw new Error('音声キャプチャは既に開始されています');
    }

    try {
      // macOS CoreAudioを使用した音声キャプチャ
      // 実際の実装では、FFmpegやsoxなどの外部ツールを使用
      const command = this.buildCaptureCommand();

      this.captureProcess = exec(command, (error, stdout) => {
        if (error) {
          this.emit('error', error);
          return;
        }

        // 音声データを処理
        this.processAudioData(stdout);
      });

      this.isCapturing = true;
      this.emit('started');

      console.log('音声キャプチャを開始しました');
    } catch (error) {
      console.error('音声キャプチャ開始エラー:', error);
      throw error;
    }
  }

  /**
   * 音声キャプチャを停止
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    try {
      if (this.captureProcess) {
        this.captureProcess.kill();
        this.captureProcess = null;
      }

      this.isCapturing = false;
      this.emit('stopped');

      console.log('音声キャプチャを停止しました');
    } catch (error) {
      console.error('音声キャプチャ停止エラー:', error);
      throw error;
    }
  }

  /**
   * キャプチャコマンドを構築
   */
  private buildCaptureCommand(): string {
    const { sampleRate, channels } = this.options;

    // FFmpegを使用した音声キャプチャコマンド
    // 実際の実装では、デバイスIDに基づいて適切なデバイスを選択
    return `ffmpeg -f avfoundation -i ":0" -ar ${sampleRate} -ac ${channels} -f s16le -`;
  }

  /**
   * 音声データを処理
   */
  private processAudioData(data: string): void {
    try {
      // 音声データをバッファに変換
      const buffer = Buffer.from(data, 'binary');

      // 250msチャンクに分割
      const chunkSize = Math.floor(
        this.options.sampleRate! * this.options.channels! * 2 * 0.25
      ); // 16bit = 2 bytes

      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        this.emit('audioData', chunk);
      }
    } catch (error) {
      console.error('音声データ処理エラー:', error);
      this.emit('error', error);
    }
  }

  /**
   * 音声レベルを取得
   */
  getAudioLevel(): number {
    // 簡易実装: 実際の実装では音声データからRMSを計算
    return Math.random() * 100;
  }

  /**
   * キャプチャ状態を取得
   */
  isCapturingAudio(): boolean {
    return this.isCapturing;
  }
}

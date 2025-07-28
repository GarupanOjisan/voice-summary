import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
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
      const args = this.buildCaptureArgs();

      console.log(`音声キャプチャコマンド: ffmpeg ${args.join(' ')}`);

      this.captureProcess = spawn('ffmpeg', args);
      
      // stdoutから音声データを受信
      this.captureProcess.stdout.on('data', (data: Buffer) => {
        this.emit('audioData', data);
      });

      this.captureProcess.stderr.on('data', (data: Buffer) => {
        console.log('FFmpeg stderr:', data.toString());
      });

      this.captureProcess.on('error', (error: Error) => {
        console.error('音声キャプチャプロセスエラー:', error);
        this.emit('error', error);
      });

      this.captureProcess.on('exit', (code: number) => {
        console.log(`音声キャプチャプロセス終了: ${code}`);
        this.isCapturing = false;
        this.emit('stopped');
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
   * 仮想オーディオデバイスからの音声キャプチャを開始
   */
  async startVirtualAudioCapture(deviceName: string): Promise<void> {
    if (this.isCapturing) {
      throw new Error('音声キャプチャは既に開始されています');
    }

    try {
      // 仮想オーディオデバイス（BlackHole）からのキャプチャコマンド
      const args = [
        '-f', 'avfoundation',
        '-i', deviceName,
        '-ar', this.options.sampleRate!.toString(),
        '-ac', this.options.channels!.toString(),
        '-f', 's16le',
        '-'
      ];

      console.log(`仮想オーディオキャプチャコマンド: ffmpeg ${args.join(' ')}`);

      this.captureProcess = spawn('ffmpeg', args);
      
      // stdoutから音声データを受信
      this.captureProcess.stdout.on('data', (data: Buffer) => {
        this.emit('audioData', data);
      });

      this.captureProcess.stderr.on('data', (data: Buffer) => {
        console.log('FFmpeg stderr:', data.toString());
      });

      this.captureProcess.on('error', (error: Error) => {
        console.error('仮想オーディオキャプチャプロセスエラー:', error);
        this.emit('error', error);
      });

      this.captureProcess.on('exit', (code: number) => {
        console.log(`仮想オーディオキャプチャプロセス終了: ${code}`);
        this.isCapturing = false;
        this.emit('stopped');
      });

      this.isCapturing = true;
      this.emit('started');

      console.log(
        `仮想オーディオデバイス ${deviceName} からの音声キャプチャを開始しました`
      );
    } catch (error) {
      console.error('仮想オーディオデバイスキャプチャ開始エラー:', error);
      throw error;
    }
  }

  /**
   * システム音声とマイク音声の混合キャプチャを開始
   */
  async startMixedAudioCapture(
    systemDevice: string,
    micDevice: string
  ): Promise<void> {
    if (this.isCapturing) {
      throw new Error('音声キャプチャは既に開始されています');
    }

    try {
      // システム音声とマイク音声を混合するFFmpegコマンド
      const args = [
        '-f', 'avfoundation',
        '-i', systemDevice,
        '-f', 'avfoundation',
        '-i', micDevice,
        '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest',
        '-ar', this.options.sampleRate!.toString(),
        '-ac', this.options.channels!.toString(),
        '-f', 's16le',
        '-'
      ];

      console.log(`混合音声キャプチャコマンド: ffmpeg ${args.join(' ')}`);

      this.captureProcess = spawn('ffmpeg', args);
      
      // stdoutから音声データを受信
      this.captureProcess.stdout.on('data', (data: Buffer) => {
        this.emit('audioData', data);
      });

      this.captureProcess.stderr.on('data', (data: Buffer) => {
        console.log('FFmpeg stderr:', data.toString());
      });

      this.captureProcess.on('error', (error: Error) => {
        console.error('混合音声キャプチャプロセスエラー:', error);
        this.emit('error', error);
      });

      this.captureProcess.on('exit', (code: number) => {
        console.log(`混合音声キャプチャプロセス終了: ${code}`);
        this.isCapturing = false;
        this.emit('stopped');
      });

      this.isCapturing = true;
      this.emit('started');

      console.log('システム音声とマイク音声の混合キャプチャを開始しました');
    } catch (error) {
      console.error('混合音声キャプチャ開始エラー:', error);
      throw error;
    }
  }

  /**
   * 内蔵マイクのみからの音声キャプチャを開始
   */
  async startMicrophoneCapture(micDevice?: string): Promise<void> {
    if (this.isCapturing) {
      throw new Error('音声キャプチャは既に開始されています');
    }

    try {
      // デフォルトは内蔵マイクを使用（インデックス1: MacBook Airのマイク）
      const deviceName = micDevice || 'MacBook Airのマイク';
      
      // 内蔵マイクのみを使用するFFmpeg引数（インデックス1を使用）
      const args = [
        '-f', 'avfoundation',
        '-i', ':1',
        '-ar', this.options.sampleRate!.toString(),
        '-ac', this.options.channels!.toString(),
        '-f', 's16le',
        '-'
      ];

      console.log(`音声キャプチャコマンド: ffmpeg ${args.join(' ')}`);

      this.captureProcess = spawn('ffmpeg', args);
      
      // stdoutから音声データを受信
      this.captureProcess.stdout.on('data', (data: Buffer) => {
        this.emit('audioData', data);
      });

      this.captureProcess.stderr.on('data', (data: Buffer) => {
        console.log('FFmpeg stderr:', data.toString());
      });

      this.captureProcess.on('error', (error: Error) => {
        console.error('音声キャプチャプロセスエラー:', error);
        this.emit('error', error);
      });

      this.captureProcess.on('exit', (code: number) => {
        console.log(`音声キャプチャプロセス終了: ${code}`);
        this.isCapturing = false;
        this.emit('stopped');
      });

      this.isCapturing = true;
      this.emit('started');

      console.log(`内蔵マイク "${deviceName}" からの音声キャプチャを開始しました`);
    } catch (error) {
      console.error('内蔵マイク音声キャプチャ開始エラー:', error);
      throw error;
    }
  }

  /**
   * キャプチャ引数を構築
   */
  private buildCaptureArgs(): string[] {
    const { sampleRate, channels } = this.options;

    // FFmpegを使用した音声キャプチャ引数
    // 実際の実装では、デバイスIDに基づいて適切なデバイスを選択
    return [
      '-f', 'avfoundation',
      '-i', ':0',
      '-ar', sampleRate!.toString(),
      '-ac', channels!.toString(),
      '-f', 's16le',
      '-'
    ];
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

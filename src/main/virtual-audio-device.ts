import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface VirtualAudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output' | 'both';
  isActive: boolean;
  isVirtual: boolean;
}

export interface VirtualAudioDeviceOptions {
  enableAutoDetection: boolean;
  enableInstallationGuide: boolean;
  preferredDriver: 'blackhole' | 'loopback' | 'auto';
}

export class VirtualAudioDeviceManager extends EventEmitter {
  private options: VirtualAudioDeviceOptions;
  private virtualDevices: VirtualAudioDevice[] = [];

  constructor(
    options: VirtualAudioDeviceOptions = {
      enableAutoDetection: true,
      enableInstallationGuide: true,
      preferredDriver: 'blackhole',
    }
  ) {
    super();
    this.options = options;
  }

  /**
   * 仮想オーディオデバイスを検出
   */
  async detectVirtualDevices(): Promise<VirtualAudioDevice[]> {
    try {
      // system_profilerを使用してオーディオデバイス情報を取得
      const { stdout } = await execAsync(
        'system_profiler SPAudioDataType -json'
      );
      const audioData = JSON.parse(stdout);

      const devices: VirtualAudioDevice[] = [];

      if (audioData.SPAudioDataType) {
        for (const device of audioData.SPAudioDataType) {
          const deviceName = device._name || '';
          const isVirtual = this.isVirtualDevice(deviceName);

          if (isVirtual) {
            devices.push({
              id: device._name || '',
              name: deviceName,
              type: this.getDeviceType(device),
              isActive: true,
              isVirtual: true,
            });
          }
        }
      }

      this.virtualDevices = devices;
      this.emit('devicesDetected', devices);
      return devices;
    } catch (error) {
      this.emit(
        'error',
        `仮想オーディオデバイスの検出に失敗: ${(error as Error).message}`
      );
      return [];
    }
  }

  /**
   * BlackHoleがインストールされているかチェック
   */
  async isBlackHoleInstalled(): Promise<boolean> {
    try {
      // BlackHoleのインストール確認
      const { stdout } = await execAsync(
        'system_profiler SPAudioDataType -json'
      );
      const audioData = JSON.parse(stdout);

      if (audioData.SPAudioDataType) {
        for (const device of audioData.SPAudioDataType) {
          const deviceName = device._name || '';
          if (deviceName.toLowerCase().includes('blackhole')) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * BlackHoleのインストール案内を取得
   */
  getBlackHoleInstallationGuide(): {
    title: string;
    description: string;
    steps: string[];
    downloadUrl: string;
  } {
    return {
      title: 'BlackHole仮想オーディオドライバのインストール',
      description:
        'システム音声をキャプチャするためにBlackHoleドライバのインストールが必要です。',
      steps: [
        '1. BlackHoleの公式サイトからドライバをダウンロード',
        '2. ダウンロードした.pkgファイルをダブルクリック',
        '3. インストーラーの指示に従ってインストール',
        '4. インストール完了後、システム環境設定でオーディオデバイスを確認',
        '5. アプリを再起動して仮想オーディオデバイスを検出',
      ],
      downloadUrl: 'https://existential.audio/blackhole/',
    };
  }

  /**
   * 仮想オーディオデバイスの設定を取得
   */
  async getVirtualDeviceConfiguration(): Promise<{
    isInstalled: boolean;
    devices: VirtualAudioDevice[];
    installationGuide?: any;
  }> {
    const isInstalled = await this.isBlackHoleInstalled();
    const devices = await this.detectVirtualDevices();

    const config: {
      isInstalled: boolean;
      devices: VirtualAudioDevice[];
      installationGuide?: any;
    } = {
      isInstalled,
      devices,
    };

    if (!isInstalled && this.options.enableInstallationGuide) {
      config.installationGuide = this.getBlackHoleInstallationGuide();
    }

    return config;
  }

  /**
   * 仮想オーディオデバイスを作成（実際にはインストール案内を表示）
   */
  async createVirtualDevice(): Promise<{ success: boolean; message: string }> {
    const isInstalled = await this.isBlackHoleInstalled();

    if (isInstalled) {
      return {
        success: true,
        message: 'BlackHoleは既にインストールされています',
      };
    }

    return {
      success: false,
      message:
        'BlackHoleのインストールが必要です。インストール案内を確認してください。',
    };
  }

  /**
   * システム音声とマイク音声の混合設定を取得
   */
  getAudioMixingConfiguration(): {
    systemAudio: boolean;
    microphoneAudio: boolean;
    mixingMode: 'separate' | 'mixed';
    outputDevice: string;
  } {
    return {
      systemAudio: true,
      microphoneAudio: true,
      mixingMode: 'mixed',
      outputDevice: 'BlackHole 2ch',
    };
  }

  /**
   * 音声ルーティング設定を更新
   */
  async updateAudioRouting(config: {
    systemAudio: boolean;
    microphoneAudio: boolean;
    mixingMode: 'separate' | 'mixed';
    outputDevice: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // 実際の実装では、CoreAudioの設定を変更
      // ここでは設定の保存のみ
      this.emit('routingUpdated', config);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `音声ルーティング設定の更新に失敗: ${(error as Error).message}`,
      };
    }
  }

  /**
   * デバイス名から仮想デバイスかどうかを判定
   */
  private isVirtualDevice(deviceName: string): boolean {
    const virtualKeywords = ['blackhole', 'loopback', 'virtual', 'null'];
    const lowerName = deviceName.toLowerCase();

    return virtualKeywords.some((keyword) => lowerName.includes(keyword));
  }

  /**
   * デバイスタイプを判定
   */
  private getDeviceType(_device: any): 'input' | 'output' | 'both' {
    // 実際の実装では、デバイスの詳細情報から判定
    // ここでは仮想的に'both'を返す
    return 'both';
  }

  /**
   * 設定を更新
   */
  updateOptions(options: Partial<VirtualAudioDeviceOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 現在の設定を取得
   */
  getOptions(): VirtualAudioDeviceOptions {
    return this.options;
  }
}

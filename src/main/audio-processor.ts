import { EventEmitter } from 'events';
import { AudioBuffer, AudioChunk, AudioBufferOptions } from './audio-buffer';

export interface AudioProcessorOptions {
  bufferOptions?: AudioBufferOptions;
  enableVUMeter?: boolean;
  enableQualityAnalysis?: boolean;
  silenceDetection?: boolean;
}

export interface AudioQualityMetrics {
  level: number;
  peak: number;
  average: number;
  silence: boolean;
  timestamp: number;
}

export class AudioProcessor extends EventEmitter {
  private audioBuffer: AudioBuffer;
  private options: AudioProcessorOptions;
  private vuMeterInterval: NodeJS.Timeout | null = null;
  private qualityMetrics: AudioQualityMetrics[] = [];
  private isProcessing = false;

  constructor(options: AudioProcessorOptions = {}) {
    super();
    this.options = {
      enableVUMeter: true,
      enableQualityAnalysis: true,
      silenceDetection: true,
      ...options,
    };

    this.audioBuffer = new AudioBuffer(this.options.bufferOptions);

    // バッファからのチャンクイベントを処理
    this.audioBuffer.on('chunk', (chunk: AudioChunk) => {
      this.processAudioChunk(chunk);
    });
  }

  /**
   * 音声データを処理に追加
   */
  addAudioData(data: Buffer): void {
    this.audioBuffer.addAudioData(data);
  }

  /**
   * 音声チャンクを処理
   */
  private processAudioChunk(chunk: AudioChunk): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // 音声品質分析
      if (this.options.enableQualityAnalysis) {
        const quality = this.audioBuffer.analyzeAudioQuality(chunk.data);
        const metrics: AudioQualityMetrics = {
          ...quality,
          timestamp: chunk.timestamp,
        };

        this.qualityMetrics.push(metrics);

        // 最新100件のみ保持
        if (this.qualityMetrics.length > 100) {
          this.qualityMetrics = this.qualityMetrics.slice(-100);
        }

        this.emit('qualityMetrics', metrics);
      }

      // 無音検出
      if (this.options.silenceDetection) {
        const quality = this.audioBuffer.analyzeAudioQuality(chunk.data);
        if (quality.silence) {
          this.emit('silenceDetected', {
            timestamp: chunk.timestamp,
            duration: chunk.duration,
          });
        }
      }

      // 処理済みチャンクを配信
      this.emit('processedChunk', chunk);
    } catch (error) {
      console.error('音声チャンク処理エラー:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * VUメーター開始
   */
  startVUMeter(intervalMs: number = 100): void {
    if (this.vuMeterInterval) {
      this.stopVUMeter();
    }

    this.vuMeterInterval = setInterval(() => {
      const bufferInfo = this.audioBuffer.getBufferInfo();
      const currentLevel = this.getCurrentAudioLevel();

      this.emit('vuMeter', {
        level: currentLevel,
        bufferUtilization: bufferInfo.utilization,
        timestamp: Date.now(),
      });
    }, intervalMs);
  }

  /**
   * VUメーター停止
   */
  stopVUMeter(): void {
    if (this.vuMeterInterval) {
      clearInterval(this.vuMeterInterval);
      this.vuMeterInterval = null;
    }
  }

  /**
   * 現在の音声レベルを取得
   */
  getCurrentAudioLevel(): number {
    if (this.qualityMetrics.length === 0) {
      return 0;
    }

    // 最新の品質メトリクスから音声レベルを取得
    const latestMetrics = this.qualityMetrics[this.qualityMetrics.length - 1];
    return latestMetrics.level;
  }

  /**
   * 音声品質メトリクスを取得
   */
  getQualityMetrics(count: number = 10): AudioQualityMetrics[] {
    return this.qualityMetrics.slice(-count);
  }

  /**
   * 平均音声レベルを取得
   */
  getAverageAudioLevel(durationMs: number = 1000): number {
    const cutoffTime = Date.now() - durationMs;
    const recentMetrics = this.qualityMetrics.filter(
      (metrics) => metrics.timestamp >= cutoffTime
    );

    if (recentMetrics.length === 0) {
      return 0;
    }

    const sum = recentMetrics.reduce((acc, metrics) => acc + metrics.level, 0);
    return sum / recentMetrics.length;
  }

  /**
   * 音声品質統計を取得
   */
  getAudioQualityStats(): {
    currentLevel: number;
    averageLevel: number;
    peakLevel: number;
    silencePercentage: number;
    bufferUtilization: number;
  } {
    const bufferInfo = this.audioBuffer.getBufferInfo();
    const currentLevel = this.getCurrentAudioLevel();
    const averageLevel = this.getAverageAudioLevel();

    let peakLevel = 0;
    let silenceCount = 0;

    this.qualityMetrics.forEach((metrics) => {
      peakLevel = Math.max(peakLevel, metrics.peak);
      if (metrics.silence) {
        silenceCount++;
      }
    });

    const silencePercentage =
      this.qualityMetrics.length > 0
        ? (silenceCount / this.qualityMetrics.length) * 100
        : 0;

    return {
      currentLevel,
      averageLevel,
      peakLevel,
      silencePercentage,
      bufferUtilization: bufferInfo.utilization,
    };
  }

  /**
   * バッファ情報を取得
   */
  getBufferInfo() {
    return this.audioBuffer.getBufferInfo();
  }

  /**
   * 処理を停止
   */
  stop(): void {
    this.stopVUMeter();
    this.audioBuffer.clear();
    this.qualityMetrics = [];
    this.isProcessing = false;
    this.emit('stopped');
  }

  /**
   * 処理を開始
   */
  start(): void {
    if (this.options.enableVUMeter) {
      this.startVUMeter();
    }
    this.emit('started');
  }

  /**
   * 設定を更新
   */
  updateOptions(options: Partial<AudioProcessorOptions>): void {
    this.options = { ...this.options, ...options };

    // VUメーター設定が変更された場合
    if (options.enableVUMeter === false) {
      this.stopVUMeter();
    } else if (options.enableVUMeter === true && !this.vuMeterInterval) {
      this.startVUMeter();
    }
  }
}

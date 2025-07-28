import { EventEmitter } from 'events';

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
  channels: number;
  duration: number; // seconds
}

export interface AudioBufferOptions {
  maxBufferSize?: number; // bytes
  chunkDuration?: number; // seconds
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export class AudioBuffer extends EventEmitter {
  private buffer: Buffer[] = [];
  private bufferSize = 0;
  private options: AudioBufferOptions;
  private isProcessing = false;

  constructor(options: AudioBufferOptions = {}) {
    super();
    this.options = {
      maxBufferSize: 1024 * 1024, // 1MB
      chunkDuration: 0.25, // 250ms
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      ...options,
    };
  }

  /**
   * 音声データをバッファに追加
   */
  addAudioData(data: Buffer): void {
    if (this.bufferSize + data.length > this.options.maxBufferSize!) {
      // バッファが一杯になった場合、古いデータを削除
      this.trimBuffer(data.length);
    }

    this.buffer.push(data);
    this.bufferSize += data.length;

    // 250msチャンクに達したら処理
    if (this.shouldProcessChunk()) {
      this.processChunk();
    }
  }

  /**
   * バッファから250msチャンクを取得
   */
  private shouldProcessChunk(): boolean {
    const chunkSize = this.calculateChunkSize();
    return this.bufferSize >= chunkSize;
  }

  /**
   * 250msチャンクのサイズを計算
   */
  private calculateChunkSize(): number {
    const { sampleRate, channels, bitDepth, chunkDuration } = this.options;
    const bytesPerSample = bitDepth! / 8;
    return Math.floor(
      sampleRate! * channels! * bytesPerSample * chunkDuration!
    );
  }

  /**
   * 250msチャンクを処理
   */
  private processChunk(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const chunkSize = this.calculateChunkSize();
    const chunkData = this.extractChunk(chunkSize);

    if (chunkData) {
      const audioChunk: AudioChunk = {
        data: chunkData,
        timestamp: Date.now(),
        sampleRate: this.options.sampleRate!,
        channels: this.options.channels!,
        duration: this.options.chunkDuration!,
      };

      this.emit('chunk', audioChunk);
    }

    this.isProcessing = false;
  }

  /**
   * バッファから指定サイズのチャンクを抽出
   */
  private extractChunk(size: number): Buffer | null {
    if (this.bufferSize < size) {
      return null;
    }

    const chunks: Buffer[] = [];
    let remainingSize = size;
    let extractedSize = 0;

    while (remainingSize > 0 && this.buffer.length > 0) {
      const currentChunk = this.buffer[0];
      const chunkSize = Math.min(remainingSize, currentChunk.length);

      if (chunkSize === currentChunk.length) {
        // チャンク全体を使用
        chunks.push(this.buffer.shift()!);
        extractedSize += chunkSize;
      } else {
        // チャンクの一部を使用
        const partialChunk = currentChunk.slice(0, chunkSize);
        chunks.push(partialChunk);
        this.buffer[0] = currentChunk.slice(chunkSize);
        extractedSize += chunkSize;
      }

      remainingSize -= chunkSize;
    }

    // バッファサイズを更新
    this.bufferSize -= extractedSize;

    // 複数のチャンクを結合
    return Buffer.concat(chunks);
  }

  /**
   * バッファをトリム（古いデータを削除）
   */
  private trimBuffer(requiredSize: number): void {
    while (
      this.bufferSize + requiredSize > this.options.maxBufferSize! &&
      this.buffer.length > 0
    ) {
      const removedChunk = this.buffer.shift()!;
      this.bufferSize -= removedChunk.length;
    }
  }

  /**
   * バッファをクリア
   */
  clear(): void {
    this.buffer = [];
    this.bufferSize = 0;
    this.emit('cleared');
  }

  /**
   * バッファの状態を取得
   */
  getBufferInfo(): {
    size: number;
    chunks: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      size: this.bufferSize,
      chunks: this.buffer.length,
      maxSize: this.options.maxBufferSize!,
      utilization: (this.bufferSize / this.options.maxBufferSize!) * 100,
    };
  }

  /**
   * 音声レベルを計算（RMS）
   */
  calculateAudioLevel(audioData: Buffer): number {
    const samples = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2
    );
    let sum = 0;

    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sum / samples.length);
    const maxValue = 32767; // 16bit signed integer max
    return (rms / maxValue) * 100;
  }

  /**
   * 音声品質を分析
   */
  analyzeAudioQuality(audioData: Buffer): {
    level: number;
    peak: number;
    average: number;
    silence: boolean;
  } {
    const samples = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2
    );
    let sum = 0;
    let peak = 0;
    let silenceCount = 0;
    const silenceThreshold = 100; // 無音判定の閾値

    for (let i = 0; i < samples.length; i++) {
      const absValue = Math.abs(samples[i]);
      sum += absValue;
      peak = Math.max(peak, absValue);

      if (absValue < silenceThreshold) {
        silenceCount++;
      }
    }

    const average = sum / samples.length;
    const maxValue = 32767;
    const level = (average / maxValue) * 100;
    const silence = silenceCount / samples.length > 0.9; // 90%以上が無音

    return {
      level,
      peak: (peak / maxValue) * 100,
      average: level,
      silence,
    };
  }
}

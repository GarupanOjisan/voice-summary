import { EventEmitter } from 'events';
import {
  WhisperManager,
  WhisperOptions,
  TranscriptionResult,
} from './whisper-manager';
import * as fs from 'fs';
import * as path from 'path';

export interface StreamingTranscriptionOptions {
  chunkDuration: number; // 秒
  overlapDuration: number; // 秒
  sampleRate: number;
  channels: number;
  bitDepth: number;
  whisperOptions?: Partial<WhisperOptions>;
}

export interface TranscriptionChunk {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  isFinal: boolean;
}

export class StreamingTranscription extends EventEmitter {
  private whisperManager: WhisperManager;
  private options: StreamingTranscriptionOptions;
  private audioBuffer: Buffer[] = [];
  private isStreaming = false;
  private chunkCounter = 0;
  private tempDir: string;
  private currentChunkStartTime = 0;

  constructor(
    whisperManager: WhisperManager,
    options: StreamingTranscriptionOptions
  ) {
    super();
    this.whisperManager = whisperManager;
    this.options = options;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDirectory();
  }

  /**
   * 一時ディレクトリの存在確認・作成
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreaming(): Promise<void> {
    if (this.isStreaming) {
      throw new Error('ストリーミングは既に開始されています');
    }

    try {
      // WhisperManagerが初期化されているかチェック
      const settings = this.whisperManager.getCurrentSettings();
      if (!settings.isInitialized) {
        await this.whisperManager.initialize();
      }

      this.isStreaming = true;
      this.currentChunkStartTime = Date.now();

      this.emit('streamingStarted');
      console.log('ストリーミング音声認識を開始しました');
    } catch (error) {
      const errorMessage = `ストリーミング開始エラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * 音声データを追加
   */
  addAudioData(data: Buffer): void {
    if (!this.isStreaming) {
      return;
    }

    this.audioBuffer.push(data);

    // バッファサイズをチェック
    const totalSize = this.audioBuffer.reduce(
      (sum, buffer) => sum + buffer.length,
      0
    );
    const chunkSize = this.calculateChunkSize();

    if (totalSize >= chunkSize) {
      this.processChunk();
    }
  }

  /**
   * チャンクサイズを計算
   */
  private calculateChunkSize(): number {
    const { sampleRate, channels, bitDepth, chunkDuration } = this.options;
    const bytesPerSample = bitDepth / 8;
    return Math.floor(sampleRate * channels * bytesPerSample * chunkDuration);
  }

  /**
   * 音声チャンクを処理
   */
  private async processChunk(): Promise<void> {
    if (this.audioBuffer.length === 0) {
      return;
    }

    try {
      // チャンクデータを結合
      const chunkData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // 一時ファイルに保存
      const chunkId = `chunk_${this.chunkCounter++}_${Date.now()}`;
      const tempFilePath = path.join(this.tempDir, `${chunkId}.wav`);

      await this.saveAudioChunk(chunkData, tempFilePath);

      // Whisperで文字起こし
      const result = await this.whisperManager.transcribeAudio(
        tempFilePath,
        this.options.whisperOptions
      );

      // 結果を処理
      const chunk: TranscriptionChunk = {
        id: chunkId,
        startTime: this.currentChunkStartTime,
        endTime: Date.now(),
        text: result.text,
        confidence: this.calculateConfidence(result),
        isFinal: true,
      };

      this.emit('transcriptionChunk', chunk);
      this.currentChunkStartTime = Date.now();

      // 一時ファイルを削除
      this.cleanupTempFile(tempFilePath);
    } catch (error) {
      const errorMessage = `チャンク処理エラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      console.error(errorMessage);
    }
  }

  /**
   * 音声チャンクを一時ファイルに保存
   */
  private async saveAudioChunk(data: Buffer, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 一時ファイルを削除
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('一時ファイル削除エラー:', error);
    }
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(result: TranscriptionResult): number {
    if (result.segments.length === 0) {
      return 0;
    }

    // 平均ログ確率から信頼度を計算
    const avgLogProb =
      result.segments.reduce((sum, segment) => sum + segment.avgLogProb, 0) /
      result.segments.length;
    return Math.max(0, Math.min(1, (avgLogProb + 1) / 2)); // -1 から 1 の範囲を 0 から 1 に正規化
  }

  /**
   * ストリーミングを停止
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    try {
      // 残りのバッファを処理
      if (this.audioBuffer.length > 0) {
        await this.processChunk();
      }

      this.isStreaming = false;
      this.emit('streamingStopped');
      console.log('ストリーミング音声認識を停止しました');
    } catch (error) {
      const errorMessage = `ストリーミング停止エラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * ストリーミング状態を取得
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * 設定を更新
   */
  updateOptions(options: Partial<StreamingTranscriptionOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('optionsUpdated', this.options);
  }

  /**
   * 現在の設定を取得
   */
  getOptions(): StreamingTranscriptionOptions {
    return this.options;
  }

  /**
   * バッファ情報を取得
   */
  getBufferInfo(): {
    bufferSize: number;
    chunkCount: number;
    isStreaming: boolean;
  } {
    const bufferSize = this.audioBuffer.reduce(
      (sum, buffer) => sum + buffer.length,
      0
    );
    return {
      bufferSize,
      chunkCount: this.chunkCounter,
      isStreaming: this.isStreaming,
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.stopStreaming();
    this.audioBuffer = [];
    this.chunkCounter = 0;
    this.currentChunkStartTime = 0;

    // 一時ディレクトリをクリーンアップ
    this.cleanupTempDirectory();

    this.emit('cleanup');
  }

  /**
   * 一時ディレクトリをクリーンアップ
   */
  private cleanupTempDirectory(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('一時ディレクトリクリーンアップエラー:', error);
    }
  }
}

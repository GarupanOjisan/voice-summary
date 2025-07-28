import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface WhisperModel {
  name: string;
  size: string;
  url: string;
  filename: string;
  description: string;
}

export interface WhisperOptions {
  model: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  temperature?: number;
  maxTokens?: number;
  bestOf?: number;
  beamSize?: number;
  patience?: number;
  lengthPenalty?: number;
  suppressTokens?: string;
  suppressBlank?: boolean;
  initialPrompt?: string;
  conditionOnPreviousText?: boolean;
  temperatureInc?: number;
  hotwords?: string;
  logProb?: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avgLogProb: number;
  compressionRatio: number;
  noSpeechProb: number;
}

export class WhisperManager extends EventEmitter {
  private models: WhisperModel[] = [
    {
      name: 'tiny',
      size: '39 MB',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      filename: 'ggml-tiny.bin',
      description: '最も軽量なモデル（英語のみ）',
    },
    {
      name: 'base',
      size: '74 MB',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      filename: 'ggml-base.bin',
      description: '基本モデル（多言語対応）',
    },
    {
      name: 'small',
      size: '244 MB',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
      filename: 'ggml-small.bin',
      description: '小型モデル（高精度）',
    },
    {
      name: 'medium',
      size: '769 MB',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
      filename: 'ggml-medium.bin',
      description: '中型モデル（高精度・多言語）',
    },
    {
      name: 'large',
      size: '1550 MB',
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large.bin',
      filename: 'ggml-large.bin',
      description: '大型モデル（最高精度）',
    },
  ];

  private modelsDir: string;
  private currentModel: string | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.modelsDir = path.join(process.cwd(), 'models');
    this.ensureModelsDirectory();
  }

  /**
   * モデルディレクトリの存在確認・作成
   */
  private ensureModelsDirectory(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  getAvailableModels(): WhisperModel[] {
    return this.models;
  }

  /**
   * ダウンロード済みモデル一覧を取得
   */
  getDownloadedModels(): string[] {
    try {
      const files = fs.readdirSync(this.modelsDir);
      return files.filter((file) => file.endsWith('.bin'));
    } catch (error) {
      return [];
    }
  }

  /**
   * モデルがダウンロード済みかチェック
   */
  isModelDownloaded(modelName: string): boolean {
    const model = this.models.find((m) => m.name === modelName);
    if (!model) return false;

    const modelPath = path.join(this.modelsDir, model.filename);
    return fs.existsSync(modelPath);
  }

  /**
   * モデルをダウンロード
   */
  async downloadModel(
    modelName: string
  ): Promise<{ success: boolean; error?: string }> {
    const model = this.models.find((m) => m.name === modelName);
    if (!model) {
      return { success: false, error: `モデル ${modelName} が見つかりません` };
    }

    const modelPath = path.join(this.modelsDir, model.filename);

    if (fs.existsSync(modelPath)) {
      return { success: true };
    }

    try {
      this.emit('downloadProgress', { model: modelName, progress: 0 });

      // curlを使用してモデルをダウンロード
      const command = `curl -L -o "${modelPath}" "${model.url}"`;

            const { stderr } = await execAsync(command);
      
      if (stderr) {
        console.log('Download stderr:', stderr);
      }

      this.emit('downloadProgress', { model: modelName, progress: 100 });
      this.emit('modelDownloaded', { model: modelName, path: modelPath });

      return { success: true };
    } catch (error) {
      const errorMessage = `モデル ${modelName} のダウンロードに失敗: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Whisperを初期化
   */
  async initialize(
    modelName: string = 'base'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isModelDownloaded(modelName)) {
        const downloadResult = await this.downloadModel(modelName);
        if (!downloadResult.success) {
          return downloadResult;
        }
      }

      this.currentModel = modelName;
      this.isInitialized = true;

      this.emit('initialized', { model: modelName });
      return { success: true };
    } catch (error) {
      const errorMessage = `Whisper初期化エラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 音声ファイルを文字起こし
   */
  async transcribeAudio(
    audioPath: string,
    options: Partial<WhisperOptions> = {}
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized || !this.currentModel) {
      throw new Error('Whisperが初期化されていません');
    }

    const modelPath = path.join(this.modelsDir, `${this.currentModel}.bin`);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`モデルファイルが見つかりません: ${modelPath}`);
    }

    try {
      // Whisperコマンドを構築
      const command = this.buildWhisperCommand(audioPath, modelPath, {
        ...options,
        model: this.currentModel,
      });

      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        console.log('Whisper stderr:', stderr);
      }

      // 結果をパース
      const result = this.parseWhisperOutput(stdout);

      this.emit('transcriptionComplete', result);
      return result;
    } catch (error) {
      const errorMessage = `文字起こしエラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * ストリーミング音声認識を開始
   */
  async startStreamingTranscription(
    audioStream: NodeJS.ReadableStream,
    _options: Partial<WhisperOptions> = {}
  ): Promise<void> {
    if (!this.isInitialized || !this.currentModel) {
      throw new Error('Whisperが初期化されていません');
    }

    try {
      // ストリーミング処理の実装
      // 実際の実装では、音声データをチャンクに分割して処理
      this.emit('streamingStarted');

      // 仮の実装：実際にはnode-whisperのストリーミング機能を使用
      console.log('ストリーミング音声認識を開始しました');
    } catch (error) {
      const errorMessage = `ストリーミング音声認識エラー: ${(error as Error).message}`;
      this.emit('error', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Whisperコマンドを構築
   */
  private buildWhisperCommand(
    audioPath: string,
    modelPath: string,
    options: WhisperOptions
  ): string {
    const {
      language,
      task = 'transcribe',
      temperature = 0,
      maxTokens,
      bestOf,
      beamSize,
      patience,
      lengthPenalty,
      suppressTokens,
      suppressBlank = true,
      initialPrompt,
      conditionOnPreviousText = true,
      temperatureInc,
      hotwords,
      logProb,
    } = options;

    let command = `whisper "${audioPath}" --model "${modelPath}" --task ${task}`;

    if (language) {
      command += ` --language ${language}`;
    }
    if (temperature !== undefined) {
      command += ` --temperature ${temperature}`;
    }
    if (maxTokens) {
      command += ` --max-tokens ${maxTokens}`;
    }
    if (bestOf) {
      command += ` --best-of ${bestOf}`;
    }
    if (beamSize) {
      command += ` --beam-size ${beamSize}`;
    }
    if (patience) {
      command += ` --patience ${patience}`;
    }
    if (lengthPenalty) {
      command += ` --length-penalty ${lengthPenalty}`;
    }
    if (suppressTokens) {
      command += ` --suppress-tokens ${suppressTokens}`;
    }
    if (suppressBlank) {
      command += ` --suppress-blank`;
    }
    if (initialPrompt) {
      command += ` --initial-prompt "${initialPrompt}"`;
    }
    if (conditionOnPreviousText) {
      command += ` --condition-on-previous-text`;
    }
    if (temperatureInc) {
      command += ` --temperature-inc ${temperatureInc}`;
    }
    if (hotwords) {
      command += ` --hotwords "${hotwords}"`;
    }
    if (logProb) {
      command += ` --log-prob ${logProb}`;
    }

    return command;
  }

  /**
   * Whisper出力をパース
   */
  private parseWhisperOutput(output: string): TranscriptionResult {
    // 実際の実装では、Whisperの出力形式に応じてパース
    // ここでは簡易的な実装
    const lines = output.trim().split('\n');
    const text = lines.join(' ');

    return {
      text,
      segments: [
        {
          id: 0,
          start: 0,
          end: 0,
          text,
          tokens: [],
          temperature: 0,
          avgLogProb: 0,
          compressionRatio: 0,
          noSpeechProb: 0,
        },
      ],
      language: 'ja',
      duration: 0,
    };
  }

  /**
   * 現在の設定を取得
   */
  getCurrentSettings(): {
    model: string | null;
    isInitialized: boolean;
    modelsDir: string;
  } {
    return {
      model: this.currentModel,
      isInitialized: this.isInitialized,
      modelsDir: this.modelsDir,
    };
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: Partial<{ model: string }>): void {
    if (settings.model && settings.model !== this.currentModel) {
      this.currentModel = settings.model;
      this.emit('settingsUpdated', { model: this.currentModel });
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.isInitialized = false;
    this.currentModel = null;
    this.emit('cleanup');
  }
}

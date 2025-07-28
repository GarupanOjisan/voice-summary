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
    
    // 自動初期化を試行（baseモデルが利用可能な場合）
    this.autoInitialize();
  }

  /**
   * 自動初期化を試行
   */
  private async autoInitialize(): Promise<void> {
    try {
      // baseモデルがダウンロード済みの場合は自動初期化
      if (this.isModelDownloaded('base')) {
        console.log('WhisperManager: baseモデルを自動初期化します');
        await this.initialize('base');
      } else {
        console.log('WhisperManager: baseモデルがダウンロードされていないため、自動初期化をスキップします');
      }
    } catch (error) {
      console.error('WhisperManager: 自動初期化に失敗しました:', error);
    }
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

    // モデル定義から正しいファイル名を取得
    const model = this.models.find((m) => m.name === this.currentModel);
    if (!model) {
      throw new Error(`モデル ${this.currentModel} が見つかりません`);
    }

    const modelPath = path.join(this.modelsDir, model.filename);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`モデルファイルが見つかりません: ${modelPath}`);
    }

    try {
      // Whisperコマンドを構築
      const command = this.buildWhisperCommand(audioPath, modelPath, {
        ...options,
        model: this.currentModel,
      });

      console.log('Whisperコマンド実行:', command);

      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        console.log('Whisper stderr:', stderr);
      }

      // JSONファイルから結果を読み取る
      const jsonFilePath = `${audioPath}.json`;
      let result: TranscriptionResult;

      try {
        if (fs.existsSync(jsonFilePath)) {
          const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
          console.log('JSON file content:', jsonContent);
          result = this.parseWhisperOutput(jsonContent);
          
          // 一時JSONファイルを削除
          fs.unlinkSync(jsonFilePath);
        } else {
          // JSONファイルが見つからない場合は、stdoutから解析
          console.log('JSON file not found, parsing stdout:', stdout);
          result = this.parseWhisperTextOutput(stdout);
        }
      } catch (fileError) {
        console.error('JSONファイル読み取りエラー:', fileError);
        // ファイル読み取りに失敗した場合は、stdoutから解析
        result = this.parseWhisperTextOutput(stdout);
      }

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

    // whisper-cliを使用（ファイルパスを最後に配置）
    let command = `whisper-cli -m "${modelPath}"`;

    if (language && language !== 'auto') {
      command += ` -l ${language}`;
    }
    
    // タスクが翻訳の場合は--translateフラグを使用
    if (task === 'translate') {
      command += ` --translate`;
    }
    
    if (temperature !== undefined) {
      command += ` --temperature ${temperature}`;
    }
    
    if (bestOf && bestOf !== 5) { // デフォルトは5
      command += ` --best-of ${bestOf}`;
    }
    
    if (beamSize && beamSize !== 5) { // デフォルトは5
      command += ` --beam-size ${beamSize}`;
    }
    
    if (initialPrompt) {
      command += ` --prompt "${initialPrompt}"`;
    }
    
    if (temperatureInc && temperatureInc !== 0.2) { // デフォルトは0.2
      command += ` --temperature-inc ${temperatureInc}`;
    }

    // 出力形式の設定
    command += ` --output-json`; // JSONファイル出力
    
    // タイムスタンプ付きテキスト出力（デフォルトでstdoutに出力される）
    // --no-printsは削除して、stdoutに結果を出力させる
    
    // 音声ファイルパスを最後に追加
    command += ` "${audioPath}"`;

    return command;
  }

  /**
   * Whisper出力をパース
   */
  private parseWhisperOutput(output: string): TranscriptionResult {
    try {
      // whisper-cliのJSON出力をパース
      const jsonOutput = JSON.parse(output);
      
      // whisper-cppのJSON出力形式に対応
      if (jsonOutput.transcription) {
        // transcription配列がある場合
        const segments = jsonOutput.transcription.map((segment: any, index: number) => ({
          id: index,
          start: segment.timestamps?.from || 0,
          end: segment.timestamps?.to || 0,
          text: segment.text || '',
          tokens: segment.tokens || [],
          temperature: 0,
          avgLogProb: 0,
          compressionRatio: 0,
          noSpeechProb: 0,
        }));

        const fullText = segments.map((s: any) => s.text).join(' ').trim();

        return {
          text: fullText,
          segments,
          language: jsonOutput.result?.language || 'ja',
          duration: jsonOutput.result?.duration || 0,
        };
      } else if (jsonOutput.text) {
        // 単純なテキストの場合
        return {
          text: jsonOutput.text.trim(),
          segments: [
            {
              id: 0,
              start: 0,
              end: jsonOutput.duration || 0,
              text: jsonOutput.text.trim(),
              tokens: [],
              temperature: 0,
              avgLogProb: 0,
              compressionRatio: 0,
              noSpeechProb: 0,
            },
          ],
          language: jsonOutput.language || 'ja',
          duration: jsonOutput.duration || 0,
        };
      }
    } catch (error) {
      console.error('JSON解析エラー:', error);
      console.log('Raw output:', output);
    }

    // JSON解析に失敗した場合やフォーマットが不明な場合は、テキストとして処理
    const lines = output.trim().split('\n');
    const text = lines.join(' ').trim();

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
   * Whisper SRTテキスト出力をパース
   */
  private parseWhisperTextOutput(output: string): TranscriptionResult {
    const lines = output.trim().split('\n');
    const segments: any[] = [];
    let currentSegment: any = null;
    let segmentId = 0;

    for (const line of lines) {
      // SRT形式の時間スタンプを検出 (例: "00:00:00.000 --> 00:00:02.000")
      const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
      
      if (timeMatch) {
        // 新しいセグメント開始
        currentSegment = {
          id: segmentId++,
          start: this.timeToSeconds(timeMatch[1]),
          end: this.timeToSeconds(timeMatch[2]),
          text: '',
          tokens: [],
          temperature: 0,
          avgLogProb: 0,
          compressionRatio: 0,
          noSpeechProb: 0,
        };
        segments.push(currentSegment);
      } else if (currentSegment && line.trim()) {
        // セグメントのテキスト部分
        if (currentSegment.text) {
          currentSegment.text += ' ' + line.trim();
        } else {
          currentSegment.text = line.trim();
        }
      }
    }

    // セグメントが見つからない場合は、全体を一つのセグメントとして処理
    if (segments.length === 0) {
      const fullText = lines.join(' ').trim();
      segments.push({
        id: 0,
        start: 0,
        end: 0,
        text: fullText,
        tokens: [],
        temperature: 0,
        avgLogProb: 0,
        compressionRatio: 0,
        noSpeechProb: 0,
      });
    }

    const fullText = segments.map(s => s.text).join(' ').trim();

    return {
      text: fullText,
      segments,
      language: 'ja',
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    };
  }

  /**
   * SRT時間フォーマットを秒に変換
   */
  private timeToSeconds(timeStr: string): number {
    const [hours, minutes, seconds] = timeStr.split(':');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
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

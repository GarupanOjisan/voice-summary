import { STTProvider, STTTranscriptionResult, STTProviderConfig } from '../stt-provider';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KotobaWhisperConfig extends STTProviderConfig {
  modelPath?: string;
  device?: 'cpu' | 'cuda';
  batchSize?: number;
  chunkLength?: number;
  language?: string;
  temperature?: number;
  suppressBlank?: boolean;
  wordTimestamps?: boolean;
}

export class KotobaWhisperProvider extends STTProvider {
  private tempDir: string;
  private chunkCounter = 0;
  private audioBuffer: Buffer[] = [];
  private modelPath: string;
  private device: 'cpu' | 'cuda';
  private batchSize: number;
  private chunkLength: number;
  private temperature: number;
  private suppressBlank: boolean;
  private wordTimestamps: boolean;

  constructor(config: KotobaWhisperConfig) {
    super(config);
    this.modelPath = config.modelPath || 'kotoba-tech/kotoba-whisper-v2.0';
    this.device = config.device || 'cpu';
    this.batchSize = config.batchSize || 1;
    this.chunkLength = config.chunkLength || 15;
    this.temperature = config.temperature || 0;
    this.suppressBlank = config.suppressBlank !== false;
    this.wordTimestamps = config.wordTimestamps || false;
    
    this.tempDir = require('os').tmpdir();
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🎤 KotobaWhisperProvider: 初期化開始');
      
      // Python環境とtransformersライブラリの確認
      await this.checkPythonEnvironment();
      
      // モデルのダウンロード確認
      await this.checkModelAvailability();
      
      console.log('🎤 KotobaWhisperProvider: 初期化完了');
      return true;
    } catch (error) {
      console.error('🎤 KotobaWhisperProvider: 初期化エラー:', error);
      return false;
    }
  }

  private async checkPythonEnvironment(): Promise<void> {
    try {
      const { stdout } = await execAsync('python3 --version');
      console.log('🎤 Python環境確認:', stdout.trim());
      
      // transformersライブラリの確認
      try {
        await execAsync('python3 -c "import transformers; print(transformers.__version__)"');
        console.log('🎤 transformersライブラリ確認: OK');
      } catch (error) {
        console.log('🎤 transformersライブラリをインストール中...');
        await execAsync('pip3 install transformers torch datasets');
      }
    } catch (error) {
      throw new Error('Python3環境が見つかりません。Python3をインストールしてください。');
    }
  }

  private async checkModelAvailability(): Promise<void> {
    try {
      const script = `
import torch
from transformers import pipeline

try:
    pipe = pipeline(
        "automatic-speech-recognition",
        model="${this.modelPath}",
        torch_dtype=torch.float32,
        device="${this.device}"
    )
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    exit(1)
`;
      
      const { stdout } = await execAsync(`python3 -c "${script}"`);
      console.log('🎤 モデル確認:', stdout.trim());
    } catch (error) {
      console.log('🎤 モデルをダウンロード中...');
      // モデルの初回ダウンロード
      await this.downloadModel();
    }
  }

  private async downloadModel(): Promise<void> {
    console.log('🎤 モデルをダウンロード中...');
    
    const scriptPath = path.join(this.tempDir, 'download_model.py');
    const script = `
import torch
from transformers import pipeline

print("Downloading kotoba-whisper-v2.0 model...")
pipe = pipeline(
    "automatic-speech-recognition",
    model="${this.modelPath}",
    torch_dtype=torch.float32,
    device="${this.device}"
)
print("Model downloaded successfully")
`;
    
    try {
      fs.writeFileSync(scriptPath, script);
      await execAsync(`python3 "${scriptPath}"`);
      fs.unlinkSync(scriptPath); // スクリプトファイルを削除
      console.log('🎤 モデルダウンロード完了');
    } catch (error) {
      // エラー時もスクリプトファイルを削除
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      throw new Error(`モデルのダウンロードに失敗しました: ${error}`);
    }
  }

  async startStreaming(): Promise<void> {
    console.log('🎤 KotobaWhisperProvider: ストリーミング開始');
    this.isStreaming = true;
    this.audioBuffer = [];
    this.chunkCounter = 0;
    this.emit('streamingStarted');
  }

  async stopStreaming(): Promise<void> {
    console.log('🎤 KotobaWhisperProvider: ストリーミング停止');
    this.isStreaming = false;
    this.audioBuffer = [];
    this.emit('streamingStopped');
  }

  async sendAudioData(data: Buffer): Promise<void> {
    if (!this.isStreaming) {
      throw new Error('ストリーミングが開始されていません');
    }

    try {
      // 音声データをバッファに追加
      this.audioBuffer.push(data);
      
      // バッファサイズをチェック（5秒分のデータがたまったら処理）
      const totalSize = this.audioBuffer.reduce((sum: number, buffer: Buffer) => sum + buffer.length, 0);
      const targetSize = (this.config.sampleRate || 16000) * 5 * 2; // 5秒分の16bit音声データ
      
      if (totalSize >= targetSize) {
        await this.processAudioBuffer();
      }
    } catch (error) {
      console.error('🎤 音声データ送信エラー:', error);
      throw error;
    }
  }

  private async processAudioBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0) {
      return;
    }

    try {
      // バッファデータを結合
      const audioData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // 一時ファイルに保存
      const tempFilePath = path.join(this.tempDir, `kotoba_whisper_${Date.now()}.wav`);
      await this.saveAudioToFile(audioData, tempFilePath);

      // Kotoba Whisperで文字起こし
      const result = await this.transcribeWithKotobaWhisper(tempFilePath);

      // 結果をイベントとして発行
      const transcriptionResult: STTTranscriptionResult = {
        text: result.text,
        confidence: result.confidence || 0.8,
        language: result.language || 'ja',
        isFinal: true,
        timestamp: Date.now(),
        segments: result.segments || [],
      };

      this.emit('transcriptionResult', transcriptionResult);

      // 一時ファイルを削除
      fs.unlinkSync(tempFilePath);
    } catch (error) {
      console.error('🎤 音声バッファ処理エラー:', error);
      this.emit('error', error);
    }
  }

  private async transcribeWithKotobaWhisper(audioFilePath: string): Promise<any> {
    const scriptPath = path.join(this.tempDir, 'transcribe.py');
    const script = `
import torch
import json
import sys
from transformers import pipeline

try:
    # モデルをロード
    pipe = pipeline(
        "automatic-speech-recognition",
        model="${this.modelPath}",
        torch_dtype=torch.float32,
        device="${this.device}",
        model_kwargs={"attn_implementation": "sdpa"} if torch.cuda.is_available() else {}
    )
    
    # 音声ファイルを文字起こし
    result = pipe(
        "${audioFilePath}",
        generate_kwargs={
            "language": "${this.config.language}",
            "task": "transcribe"
        },
        return_timestamps=True
    )
    
    # 結果をJSON形式で出力
    output = {
        "text": result["text"],
        "language": "${this.config.language}",
        "segments": []
    }
    
    if "chunks" in result:
        for chunk in result["chunks"]:
            output["segments"].append({
                "start": chunk["timestamp"][0],
                "end": chunk["timestamp"][1],
                "text": chunk["text"],
                "confidence": 0.8
            })
    
    print(json.dumps(output, ensure_ascii=False))
    
except Exception as e:
    error_output = {"error": str(e)}
    print(json.dumps(error_output, ensure_ascii=False))
    sys.exit(1)
`;

    try {
      fs.writeFileSync(scriptPath, script);
      const { stdout } = await execAsync(`python3 "${scriptPath}"`);
      fs.unlinkSync(scriptPath); // スクリプトファイルを削除
      
      const result = JSON.parse(stdout);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      // エラー時もスクリプトファイルを削除
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      console.error('🎤 Kotoba Whisper文字起こしエラー:', error);
      throw error;
    }
  }

  private async saveAudioToFile(audioData: Buffer, filePath: string): Promise<void> {
    try {
      // WAVファイルヘッダーを作成
      const sampleRate = this.config.sampleRate || 16000;
      const channels = this.config.channels || 1;
      const bitsPerSample = 16;
      
      const header = this.createWavHeader(audioData.length, sampleRate, channels, bitsPerSample);
      const wavData = Buffer.concat([header, audioData]);
      
      fs.writeFileSync(filePath, wavData);
    } catch (error) {
      console.error('🎤 音声ファイル保存エラー:', error);
      throw error;
    }
  }

  private createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // byte rate
    header.writeUInt16LE(channels * bitsPerSample / 8, 32); // block align
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
  }

  getProviderType(): string {
    return 'kotoba-whisper';
  }

  getProviderName(): string {
    return 'Kotoba Whisper v2.0';
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  getSupportedLanguages(): string[] {
    return ['ja', 'en'];
  }

  getSupportedModels(): string[] {
    return ['kotoba-tech/kotoba-whisper-v2.0'];
  }

  async transcribeFile(filePath: string): Promise<STTTranscriptionResult> {
    try {
      const result = await this.transcribeWithKotobaWhisper(filePath);
      
      return {
        text: result.text,
        confidence: result.confidence || 0.8,
        language: result.language || 'ja',
        isFinal: true,
        timestamp: Date.now(),
        segments: result.segments || [],
      };
    } catch (error) {
      console.error('🎤 ファイル文字起こしエラー:', error);
      throw error;
    }
  }

  async getModelInfo(): Promise<any> {
    return {
      name: 'kotoba-tech/kotoba-whisper-v2.0',
      version: '2.0',
      description: 'Japanese-optimized Whisper model',
      language: 'Japanese',
      speed: '6.3x faster than large-v3',
      accuracy: 'Better CER/WER than large-v3 for Japanese',
    };
  }
} 

import { EventEmitter } from 'events';

export interface STTProviderConfig {
  apiKey: string;
  language?: string;
  model?: string;
  sampleRate?: number;
  channels?: number;
  encoding?: string;
}

export interface STTTranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  segments?: STTSegment[];
  isFinal: boolean;
  timestamp: number;
}

export interface STTSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker?: string;
}

export interface STTStreamingOptions {
  language?: string;
  model?: string;
  interimResults?: boolean;
  punctuate?: boolean;
  profanityFilter?: boolean;
  smartFormat?: boolean;
  diarize?: boolean;
  speakerLabels?: boolean;
}

export abstract class STTProvider extends EventEmitter {
  protected config: STTProviderConfig;
  protected isStreaming = false;

  constructor(config: STTProviderConfig) {
    super();
    this.config = config;
  }

  abstract initialize(): Promise<boolean>;
  abstract startStreaming(options?: STTStreamingOptions): Promise<void>;
  abstract stopStreaming(): Promise<void>;
  abstract sendAudioData(data: Buffer): Promise<void>;
  abstract transcribeFile(filePath: string): Promise<STTTranscriptionResult>;

  getConfig(): STTProviderConfig {
    return this.config;
  }

  updateConfig(config: Partial<STTProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  abstract getSupportedLanguages(): string[];
  abstract getSupportedModels(): string[];
  abstract getProviderName(): string;
}

export enum STTProviderType {
  ASSEMBLY_AI = 'assemblyai',
  DEEPGRAM = 'deepgram',
  GOOGLE_STT = 'google_stt',
  WHISPER_LOCAL = 'whisper_local',
  KOTOBA_WHISPER = 'kotoba_whisper'
}

export interface STTProviderFactory {
  createProvider(type: STTProviderType, config: STTProviderConfig): STTProvider;
  getSupportedProviders(): STTProviderType[];
} 

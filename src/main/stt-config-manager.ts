import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import {
  STTEngineConfig,
  STTEngineOptions,
} from './stt-engine';
import { STTProviderType } from './stt-provider';
import { STTProviderConfig } from './stt-provider';

export interface STTConfigProfile {
  id: string;
  name: string;
  description?: string;
  engineConfig: STTEngineConfig;
  defaultOptions: STTEngineOptions;
  createdAt: Date;
  updatedAt: Date;
}

export interface STTConfigManagerConfig {
  configDir: string;
  defaultProfileId: string;
  autoSave: boolean;
  backupEnabled: boolean;
  maxBackups: number;
}

export class STTConfigManager extends EventEmitter {
  private config: STTConfigManagerConfig;
  private profiles: Map<string, STTConfigProfile> = new Map();
  private currentProfileId: string;
  private configFilePath: string;
  private backupDir: string;

  constructor(config: STTConfigManagerConfig) {
    super();
    this.config = config;
    this.currentProfileId = config.defaultProfileId;
    this.configFilePath = path.join(config.configDir, 'stt-config.json');
    this.backupDir = path.join(config.configDir, 'backups');
    
    this.ensureDirectories();
    this.loadProfiles();
  }

  /**
   * 必要なディレクトリを作成
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.config.configDir)) {
      fs.mkdirSync(this.config.configDir, { recursive: true });
    }
    
    if (this.config.backupEnabled && !fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * プロファイルを読み込み
   */
  private loadProfiles(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf8');
        const profilesData = JSON.parse(data);
        
        for (const profileData of profilesData.profiles || []) {
          const profile: STTConfigProfile = {
            ...profileData,
            createdAt: new Date(profileData.createdAt),
            updatedAt: new Date(profileData.updatedAt),
          };
          this.profiles.set(profile.id, profile);
        }
        
        this.currentProfileId = profilesData.currentProfileId || this.config.defaultProfileId;
      }
    } catch (error) {
      console.error('プロファイル読み込みエラー:', error);
      this.createDefaultProfiles();
    }
  }

  /**
   * デフォルトプロファイルを作成
   */
  private createDefaultProfiles(): void {
    // Whisper Local プロファイル
    const whisperLocalProfile: STTConfigProfile = {
      id: 'whisper-local',
      name: 'Whisper Local',
      description: 'ローカルWhisperを使用した高精度な音声認識',
      engineConfig: {
        defaultProvider: STTProviderType.WHISPER_LOCAL,
        providers: {
          [STTProviderType.WHISPER_LOCAL]: {
            apiKey: '',
            language: 'ja',
            sampleRate: 16000,
            channels: 1,
          },
        },
        autoSwitch: false,
        retryAttempts: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 5,
      },
      defaultOptions: {
        language: 'ja',
        model: 'base',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        confidenceThreshold: 0.7,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // AssemblyAI プロファイル
    const assemblyAIProfile: STTConfigProfile = {
      id: 'assemblyai',
      name: 'AssemblyAI',
      description: 'AssemblyAI APIを使用した高精度な音声認識',
      engineConfig: {
        defaultProvider: STTProviderType.ASSEMBLY_AI,
        providers: {
          [STTProviderType.ASSEMBLY_AI]: {
            apiKey: '',
            language: 'ja',
            sampleRate: 16000,
            channels: 1,
          },
        },
        autoSwitch: true,
        fallbackProvider: STTProviderType.WHISPER_LOCAL,
        retryAttempts: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 10,
      },
      defaultOptions: {
        language: 'ja',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        diarize: false,
        speakerLabels: false,
        confidenceThreshold: 0.8,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Deepgram プロファイル
    const deepgramProfile: STTConfigProfile = {
      id: 'deepgram',
      name: 'Deepgram',
      description: 'Deepgram APIを使用した低レイテンシー音声認識',
      engineConfig: {
        defaultProvider: STTProviderType.DEEPGRAM,
        providers: {
          [STTProviderType.DEEPGRAM]: {
            apiKey: '',
            language: 'ja',
            sampleRate: 16000,
            channels: 1,
          },
        },
        autoSwitch: true,
        fallbackProvider: STTProviderType.WHISPER_LOCAL,
        retryAttempts: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 10,
      },
      defaultOptions: {
        language: 'ja',
        model: 'nova-2',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        diarize: false,
        speakerLabels: false,
        confidenceThreshold: 0.8,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Google STT プロファイル
    const googleSTTProfile: STTConfigProfile = {
      id: 'google-stt',
      name: 'Google STT',
      description: 'Google Speech-to-Text APIを使用した音声認識',
      engineConfig: {
        defaultProvider: STTProviderType.GOOGLE_STT,
        providers: {
          [STTProviderType.GOOGLE_STT]: {
            apiKey: '',
            language: 'ja-JP',
            sampleRate: 16000,
            channels: 1,
          },
        },
        autoSwitch: true,
        fallbackProvider: STTProviderType.WHISPER_LOCAL,
        retryAttempts: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 10,
      },
      defaultOptions: {
        language: 'ja-JP',
        model: 'default',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        diarize: false,
        speakerLabels: false,
        confidenceThreshold: 0.8,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(whisperLocalProfile.id, whisperLocalProfile);
    this.profiles.set(assemblyAIProfile.id, assemblyAIProfile);
    this.profiles.set(deepgramProfile.id, deepgramProfile);
    this.profiles.set(googleSTTProfile.id, googleSTTProfile);

    this.currentProfileId = 'whisper-local';
    this.saveProfiles();
  }

  /**
   * プロファイルを保存
   */
  private saveProfiles(): void {
    try {
      const data = {
        currentProfileId: this.currentProfileId,
        profiles: Array.from(this.profiles.values()),
      };

      // バックアップを作成
      if (this.config.backupEnabled && fs.existsSync(this.configFilePath)) {
        this.createBackup();
      }

      fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2));
      this.emit('profilesSaved');
    } catch (error) {
      console.error('プロファイル保存エラー:', error);
      this.emit('saveError', error);
    }
  }

  /**
   * バックアップを作成
   */
  private createBackup(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `stt-config-${timestamp}.json`);
      
      fs.copyFileSync(this.configFilePath, backupPath);
      
      // 古いバックアップを削除
      this.cleanupOldBackups();
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
    }
  }

  /**
   * 古いバックアップを削除
   */
  private cleanupOldBackups(): void {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('stt-config-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 最大バックアップ数を超えた分を削除
      if (files.length > this.config.maxBackups) {
        for (let i = this.config.maxBackups; i < files.length; i++) {
          fs.unlinkSync(files[i].path);
        }
      }
    } catch (error) {
      console.error('バックアップクリーンアップエラー:', error);
    }
  }

  /**
   * プロファイルを作成
   */
  createProfile(
    name: string,
    engineConfig: STTEngineConfig,
    defaultOptions: STTEngineOptions,
    description?: string
  ): string {
    const id = this.generateProfileId();
    const profile: STTConfigProfile = {
      id,
      name,
      description,
      engineConfig,
      defaultOptions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(id, profile);
    
    if (this.config.autoSave) {
      this.saveProfiles();
    }

    this.emit('profileCreated', profile);
    return id;
  }

  /**
   * プロファイルを更新
   */
  updateProfile(
    id: string,
    updates: Partial<Omit<STTConfigProfile, 'id' | 'createdAt'>>
  ): boolean {
    const profile = this.profiles.get(id);
    if (!profile) {
      return false;
    }

    const updatedProfile: STTConfigProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date(),
    };

    this.profiles.set(id, updatedProfile);
    
    if (this.config.autoSave) {
      this.saveProfiles();
    }

    this.emit('profileUpdated', updatedProfile);
    return true;
  }

  /**
   * プロファイルを削除
   */
  deleteProfile(id: string): boolean {
    if (id === this.currentProfileId) {
      return false; // 現在のプロファイルは削除不可
    }

    const profile = this.profiles.get(id);
    if (!profile) {
      return false;
    }

    this.profiles.delete(id);
    
    if (this.config.autoSave) {
      this.saveProfiles();
    }

    this.emit('profileDeleted', profile);
    return true;
  }

  /**
   * プロファイルを取得
   */
  getProfile(id: string): STTConfigProfile | null {
    return this.profiles.get(id) || null;
  }

  /**
   * すべてのプロファイルを取得
   */
  getAllProfiles(): STTConfigProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 現在のプロファイルを取得
   */
  getCurrentProfile(): STTConfigProfile | null {
    return this.profiles.get(this.currentProfileId) || null;
  }

  /**
   * 現在のプロファイルを設定
   */
  setCurrentProfile(id: string): boolean {
    if (!this.profiles.has(id)) {
      return false;
    }

    this.currentProfileId = id;
    
    if (this.config.autoSave) {
      this.saveProfiles();
    }

    this.emit('currentProfileChanged', this.profiles.get(id));
    return true;
  }

  /**
   * プロファイルを複製
   */
  duplicateProfile(id: string, newName: string): string | null {
    const profile = this.profiles.get(id);
    if (!profile) {
      return null;
    }

    const newId = this.generateProfileId();
    const duplicatedProfile: STTConfigProfile = {
      ...profile,
      id: newId,
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(newId, duplicatedProfile);
    
    if (this.config.autoSave) {
      this.saveProfiles();
    }

    this.emit('profileDuplicated', duplicatedProfile);
    return newId;
  }

  /**
   * プロファイルをエクスポート
   */
  exportProfile(id: string): string | null {
    const profile = this.profiles.get(id);
    if (!profile) {
      return null;
    }

    return JSON.stringify(profile, null, 2);
  }

  /**
   * プロファイルをインポート
   */
  importProfile(profileData: string): string | null {
    try {
      const profile: STTConfigProfile = JSON.parse(profileData);
      
      // 必須フィールドの検証
      if (!profile.id || !profile.name || !profile.engineConfig) {
        throw new Error('無効なプロファイルデータ');
      }

      // IDの重複を避ける
      if (this.profiles.has(profile.id)) {
        profile.id = this.generateProfileId();
      }

      profile.createdAt = new Date();
      profile.updatedAt = new Date();

      this.profiles.set(profile.id, profile);
      
      if (this.config.autoSave) {
        this.saveProfiles();
      }

      this.emit('profileImported', profile);
      return profile.id;
    } catch (error) {
      console.error('プロファイルインポートエラー:', error);
      return null;
    }
  }

  /**
   * プロファイルIDを生成
   */
  private generateProfileId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 設定を手動保存
   */
  save(): void {
    this.saveProfiles();
  }

  /**
   * 設定をリロード
   */
  reload(): void {
    this.profiles.clear();
    this.loadProfiles();
    this.emit('profilesReloaded');
  }

  /**
   * 設定をリセット
   */
  reset(): void {
    this.profiles.clear();
    this.createDefaultProfiles();
    this.emit('profilesReset');
  }

  /**
   * 設定ディレクトリを取得
   */
  getConfigDir(): string {
    return this.config.configDir;
  }

  /**
   * 現在のプロファイルIDを取得
   */
  getCurrentProfileId(): string {
    return this.currentProfileId;
  }
} 

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { LLMProviderType, LLMProviderConfig } from './llm-provider';

export interface LLMSettings {
  defaultProvider: LLMProviderType;
  providers: {
    [key in LLMProviderType]?: LLMProviderConfig;
  };
  autoSwitch: boolean;
  fallbackProvider?: LLMProviderType;
  costLimit: {
    daily: number;
    monthly: number;
    enabled: boolean;
  };
  modelSettings: {
    [key in LLMProviderType]?: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
  };
}

export interface APIKeyInfo {
  provider: LLMProviderType;
  key: string;
  maskedKey: string;
  isValid: boolean;
  lastUsed: number;
  usageCount: number;
}

export interface LocalModelInfo {
  id: string;
  name: string;
  provider: LLMProviderType;
  filePath: string;
  fileSize: number;
  downloadDate: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  status: 'not_downloaded' | 'downloading' | 'downloaded' | 'error';
}

export interface CostInfo {
  provider: LLMProviderType;
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
  requests: number;
}

export interface CostLimit {
  daily: number;
  monthly: number;
  enabled: boolean;
}

export class LLMSettingsManager extends EventEmitter {
  private settingsPath: string;
  private settings: LLMSettings;
  private apiKeys: Map<LLMProviderType, APIKeyInfo> = new Map();
  private localModels: Map<string, LocalModelInfo> = new Map();
  private costHistory: CostInfo[] = [];
  private costLimits: CostLimit;

  constructor(settingsPath?: string) {
    super();
    this.settingsPath = settingsPath || path.join(process.cwd(), 'config', 'llm-settings.json');
    this.costLimits = {
      daily: 10.0, // $10/day
      monthly: 100.0, // $100/month
      enabled: true,
    };

    this.settings = this.getDefaultSettings();
    this.loadSettings();
    this.loadAPIKeys();
    this.loadLocalModels();
    this.loadCostHistory();
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultSettings(): LLMSettings {
    return {
      defaultProvider: LLMProviderType.LOCAL_LLAMA,
      providers: {
        [LLMProviderType.OPENAI]: {
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        [LLMProviderType.GEMINI]: {
          model: 'gemini-1.5-pro',
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        [LLMProviderType.LOCAL_LLAMA]: {
          model: 'llama-3-8b',
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 60000,
          retryAttempts: 2,
          retryDelay: 2000,
        },
      },
      autoSwitch: true,
      fallbackProvider: LLMProviderType.LOCAL_LLAMA,
      costLimit: {
        daily: 10.0,
        monthly: 100.0,
        enabled: true,
      },
      modelSettings: {
        [LLMProviderType.OPENAI]: {
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 1000,
        },
        [LLMProviderType.GEMINI]: {
          model: 'gemini-1.5-pro',
          temperature: 0.7,
          maxTokens: 1000,
        },
        [LLMProviderType.LOCAL_LLAMA]: {
          model: 'llama-3-8b',
          temperature: 0.7,
          maxTokens: 1000,
        },
      },
    };
  }

  /**
   * 設定を読み込み
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        this.settings = { ...this.settings, ...JSON.parse(data) };
      } else {
        this.saveSettings();
      }
    } catch (error) {
      console.error('設定ファイルの読み込みエラー:', error);
      this.emit('error', { error, operation: 'loadSettings' });
    }
  }

  /**
   * 設定を保存
   */
  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      this.emit('settingsSaved', this.settings);
    } catch (error) {
      console.error('設定ファイルの保存エラー:', error);
      this.emit('error', { error, operation: 'saveSettings' });
    }
  }

  /**
   * APIキーを読み込み
   */
  private loadAPIKeys(): void {
    try {
      const keysPath = path.join(path.dirname(this.settingsPath), 'api-keys.json');
      if (fs.existsSync(keysPath)) {
        const data = fs.readFileSync(keysPath, 'utf8');
        const keys = JSON.parse(data);
        this.apiKeys = new Map(Object.entries(keys).map(([provider, info]) => [
          provider as LLMProviderType,
          info as APIKeyInfo,
        ]));
      }
    } catch (error) {
      console.error('APIキーファイルの読み込みエラー:', error);
    }
  }

  /**
   * APIキーを保存
   */
  private saveAPIKeys(): void {
    try {
      const keysPath = path.join(path.dirname(this.settingsPath), 'api-keys.json');
      const keys = Object.fromEntries(this.apiKeys);
      fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
      this.emit('apiKeysSaved', Array.from(this.apiKeys.values()));
    } catch (error) {
      console.error('APIキーファイルの保存エラー:', error);
      this.emit('error', { error, operation: 'saveAPIKeys' });
    }
  }

  /**
   * ローカルモデル情報を読み込み
   */
  private loadLocalModels(): void {
    try {
      const modelsPath = path.join(path.dirname(this.settingsPath), 'local-models.json');
      if (fs.existsSync(modelsPath)) {
        const data = fs.readFileSync(modelsPath, 'utf8');
        const models = JSON.parse(data);
        this.localModels = new Map(Object.entries(models).map(([id, info]) => [
          id,
          info as LocalModelInfo,
        ]));
      }
    } catch (error) {
      console.error('ローカルモデルファイルの読み込みエラー:', error);
    }
  }

  /**
   * ローカルモデル情報を保存
   */
  private saveLocalModels(): void {
    try {
      const modelsPath = path.join(path.dirname(this.settingsPath), 'local-models.json');
      const models = Object.fromEntries(this.localModels);
      fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2));
      this.emit('localModelsSaved', Array.from(this.localModels.values()));
    } catch (error) {
      console.error('ローカルモデルファイルの保存エラー:', error);
      this.emit('error', { error, operation: 'saveLocalModels' });
    }
  }

  /**
   * コスト履歴を読み込み
   */
  private loadCostHistory(): void {
    try {
      const costPath = path.join(path.dirname(this.settingsPath), 'cost-history.json');
      if (fs.existsSync(costPath)) {
        const data = fs.readFileSync(costPath, 'utf8');
        this.costHistory = JSON.parse(data);
      }
    } catch (error) {
      console.error('コスト履歴ファイルの読み込みエラー:', error);
    }
  }

  /**
   * コスト履歴を保存
   */
  private saveCostHistory(): void {
    try {
      const costPath = path.join(path.dirname(this.settingsPath), 'cost-history.json');
      fs.writeFileSync(costPath, JSON.stringify(this.costHistory, null, 2));
      this.emit('costHistorySaved', this.costHistory);
    } catch (error) {
      console.error('コスト履歴ファイルの保存エラー:', error);
      this.emit('error', { error, operation: 'saveCostHistory' });
    }
  }

  /**
   * 設定を取得
   */
  getSettings(): LLMSettings {
    return { ...this.settings };
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: Partial<LLMSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * デフォルトプロバイダーを設定
   */
  setDefaultProvider(provider: LLMProviderType): void {
    this.settings.defaultProvider = provider;
    this.saveSettings();
    this.emit('defaultProviderChanged', provider);
  }

  /**
   * プロバイダー設定を更新
   */
  updateProviderConfig(provider: LLMProviderType, config: Partial<LLMProviderConfig>): void {
    this.settings.providers[provider] = {
      ...this.settings.providers[provider],
      ...config,
    };
    this.saveSettings();
    this.emit('providerConfigUpdated', { provider, config: this.settings.providers[provider] });
  }

  /**
   * APIキーを追加・更新
   */
  setAPIKey(provider: LLMProviderType, key: string): void {
    const maskedKey = this.maskAPIKey(key);
    const apiKeyInfo: APIKeyInfo = {
      provider,
      key,
      maskedKey,
      isValid: true, // 実際の実装ではAPIキーの有効性をテスト
      lastUsed: Date.now(),
      usageCount: 0,
    };

    this.apiKeys.set(provider, apiKeyInfo);
    this.saveAPIKeys();
    this.emit('apiKeyUpdated', apiKeyInfo);
  }

  /**
   * APIキーを取得
   */
  getAPIKey(provider: LLMProviderType): string | null {
    const apiKeyInfo = this.apiKeys.get(provider);
    return apiKeyInfo ? apiKeyInfo.key : null;
  }

  /**
   * APIキー情報を取得
   */
  getAPIKeyInfo(provider: LLMProviderType): APIKeyInfo | null {
    return this.apiKeys.get(provider) || null;
  }

  /**
   * すべてのAPIキー情報を取得
   */
  getAllAPIKeys(): APIKeyInfo[] {
    return Array.from(this.apiKeys.values());
  }

  /**
   * APIキーを削除
   */
  removeAPIKey(provider: LLMProviderType): boolean {
    const removed = this.apiKeys.delete(provider);
    if (removed) {
      this.saveAPIKeys();
      this.emit('apiKeyRemoved', provider);
    }
    return removed;
  }

  /**
   * APIキーをマスク
   */
  private maskAPIKey(key: string): string {
    if (key.length <= 8) {
      return '*'.repeat(key.length);
    }
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  }

  /**
   * ローカルモデルを追加・更新
   */
  addLocalModel(modelInfo: LocalModelInfo): void {
    this.localModels.set(modelInfo.id, modelInfo);
    this.saveLocalModels();
    this.emit('localModelAdded', modelInfo);
  }

  /**
   * ローカルモデル情報を取得
   */
  getLocalModel(id: string): LocalModelInfo | null {
    return this.localModels.get(id) || null;
  }

  /**
   * すべてのローカルモデルを取得
   */
  getAllLocalModels(): LocalModelInfo[] {
    return Array.from(this.localModels.values());
  }

  /**
   * プロバイダー別のローカルモデルを取得
   */
  getLocalModelsByProvider(provider: LLMProviderType): LocalModelInfo[] {
    return Array.from(this.localModels.values()).filter(model => model.provider === provider);
  }

  /**
   * ローカルモデルを削除
   */
  removeLocalModel(id: string): boolean {
    const model = this.localModels.get(id);
    if (model && model.isDownloaded) {
      try {
        fs.unlinkSync(model.filePath);
      } catch (error) {
        console.error('モデルファイルの削除エラー:', error);
      }
    }

    const removed = this.localModels.delete(id);
    if (removed) {
      this.saveLocalModels();
      this.emit('localModelRemoved', id);
    }
    return removed;
  }

  /**
   * ローカルモデルのダウンロード状況を更新
   */
  updateLocalModelStatus(id: string, status: LocalModelInfo['status'], progress?: number): void {
    const model = this.localModels.get(id);
    if (model) {
      model.status = status;
      if (progress !== undefined) {
        model.downloadProgress = progress;
      }
      if (status === 'downloaded') {
        model.isDownloaded = true;
        model.downloadDate = Date.now();
      }
      this.saveLocalModels();
      this.emit('localModelStatusUpdated', { id, status, progress });
    }
  }

  /**
   * コストを記録
   */
  recordCost(provider: LLMProviderType, tokens: number, cost: number): void {
    const today = new Date().toISOString().split('T')[0];
    const costInfo: CostInfo = {
      provider,
      date: today,
      tokens,
      cost,
      requests: 1,
    };

    // 既存の記録を更新または新規追加
    const existingIndex = this.costHistory.findIndex(
      record => record.provider === provider && record.date === today
    );

    if (existingIndex >= 0) {
      this.costHistory[existingIndex].tokens += tokens;
      this.costHistory[existingIndex].cost += cost;
      this.costHistory[existingIndex].requests += 1;
    } else {
      this.costHistory.push(costInfo);
    }

    this.saveCostHistory();
    this.emit('costRecorded', costInfo);

    // コスト制限チェック
    this.checkCostLimits();
  }

  /**
   * コスト制限をチェック
   */
  private checkCostLimits(): void {
    if (!this.costLimits.enabled) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    const dailyCost = this.costHistory
      .filter(record => record.date === today)
      .reduce((sum, record) => sum + record.cost, 0);

    const monthlyCost = this.costHistory
      .filter(record => record.date.startsWith(thisMonth))
      .reduce((sum, record) => sum + record.cost, 0);

    if (dailyCost > this.costLimits.daily) {
      this.emit('costLimitExceeded', { type: 'daily', limit: this.costLimits.daily, actual: dailyCost });
    }

    if (monthlyCost > this.costLimits.monthly) {
      this.emit('costLimitExceeded', { type: 'monthly', limit: this.costLimits.monthly, actual: monthlyCost });
    }
  }

  /**
   * コスト制限を設定
   */
  setCostLimits(limits: Partial<CostLimit>): void {
    this.costLimits = { ...this.costLimits, ...limits };
    this.settings.costLimit = this.costLimits;
    this.saveSettings();
    this.emit('costLimitsUpdated', this.costLimits);
  }

  /**
   * コスト制限を取得
   */
  getCostLimits(): CostLimit {
    return { ...this.costLimits };
  }

  /**
   * コスト履歴を取得
   */
  getCostHistory(days: number = 30): CostInfo[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    return this.costHistory.filter(record => record.date >= cutoffString);
  }

  /**
   * 今日のコストを取得
   */
  getTodayCost(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.costHistory
      .filter(record => record.date === today)
      .reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * 今月のコストを取得
   */
  getMonthlyCost(): number {
    const thisMonth = new Date().toISOString().split('T')[0].substring(0, 7);
    return this.costHistory
      .filter(record => record.date.startsWith(thisMonth))
      .reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * プロバイダー別のコスト統計を取得
   */
  getProviderCostStats(days: number = 30): Map<LLMProviderType, { totalCost: number; totalTokens: number; requests: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    const stats = new Map();
    const filteredHistory = this.costHistory.filter(record => record.date >= cutoffString);

    for (const record of filteredHistory) {
      const existing = stats.get(record.provider) || { totalCost: 0, totalTokens: 0, requests: 0 };
      existing.totalCost += record.cost;
      existing.totalTokens += record.tokens;
      existing.requests += record.requests;
      stats.set(record.provider, existing);
    }

    return stats;
  }

  /**
   * 設定をリセット
   */
  resetSettings(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
    this.emit('settingsReset', this.settings);
  }

  /**
   * すべてのデータをクリア
   */
  clearAllData(): void {
    this.apiKeys.clear();
    this.localModels.clear();
    this.costHistory = [];
    this.saveAPIKeys();
    this.saveLocalModels();
    this.saveCostHistory();
    this.emit('allDataCleared');
  }
} 

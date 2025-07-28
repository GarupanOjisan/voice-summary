import { ipcMain } from 'electron';
import { LLMSettingsManager } from './llm-settings-manager';
import { LLMProviderType } from './llm-provider';

let settingsManager: LLMSettingsManager | null = null;

export function initializeLLMSettingsHandlers(): void {
  if (!settingsManager) {
    settingsManager = new LLMSettingsManager();
  }

  // 設定取得
  ipcMain.handle('llm-settings:get-settings', async () => {
    try {
      return settingsManager?.getSettings();
    } catch (error) {
      console.error('LLM設定取得エラー:', error);
      throw error;
    }
  });

  // 設定更新
  ipcMain.handle('llm-settings:update-settings', async (event, settings) => {
    try {
      settingsManager?.updateSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('LLM設定更新エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // デフォルトプロバイダー設定
  ipcMain.handle('llm-settings:set-default-provider', async (event, provider) => {
    try {
      settingsManager?.setDefaultProvider(provider as LLMProviderType);
      return { success: true };
    } catch (error) {
      console.error('デフォルトプロバイダー設定エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // APIキー取得
  ipcMain.handle('llm-settings:get-api-keys', async () => {
    try {
      return settingsManager?.getAllAPIKeys() || [];
    } catch (error) {
      console.error('APIキー取得エラー:', error);
      throw error;
    }
  });

  // APIキー設定
  ipcMain.handle('llm-settings:set-api-key', async (event, provider, key) => {
    try {
      settingsManager?.setAPIKey(provider as LLMProviderType, key);
      return { success: true };
    } catch (error) {
      console.error('APIキー設定エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // APIキー削除
  ipcMain.handle('llm-settings:remove-api-key', async (event, provider) => {
    try {
      const removed = settingsManager?.removeAPIKey(provider as LLMProviderType);
      return { success: removed || false };
    } catch (error) {
      console.error('APIキー削除エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ローカルモデル取得
  ipcMain.handle('llm-settings:get-local-models', async () => {
    try {
      return settingsManager?.getAllLocalModels() || [];
    } catch (error) {
      console.error('ローカルモデル取得エラー:', error);
      throw error;
    }
  });

  // ローカルモデル追加
  ipcMain.handle('llm-settings:add-local-model', async (event, modelInfo) => {
    try {
      settingsManager?.addLocalModel(modelInfo);
      return { success: true };
    } catch (error) {
      console.error('ローカルモデル追加エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ローカルモデル削除
  ipcMain.handle('llm-settings:remove-local-model', async (event, id) => {
    try {
      const removed = settingsManager?.removeLocalModel(id);
      return { success: removed || false };
    } catch (error) {
      console.error('ローカルモデル削除エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // モデルダウンロード
  ipcMain.handle('llm-settings:download-model', async (event, id) => {
    try {
      // 実際の実装ではダウンロード処理を実装
      // ここではモック実装
      settingsManager?.updateLocalModelStatus(id, 'downloading', 0);
      
      // モックダウンロードプロセス
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        settingsManager?.updateLocalModelStatus(id, 'downloading', progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          settingsManager?.updateLocalModelStatus(id, 'downloaded', 100);
        }
      }, 500);

      return { success: true };
    } catch (error) {
      console.error('モデルダウンロードエラー:', error);
      settingsManager?.updateLocalModelStatus(id, 'error');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // コスト履歴取得
  ipcMain.handle('llm-settings:get-cost-history', async (event, days = 30) => {
    try {
      return settingsManager?.getCostHistory(days) || [];
    } catch (error) {
      console.error('コスト履歴取得エラー:', error);
      throw error;
    }
  });

  // コスト制限取得
  ipcMain.handle('llm-settings:get-cost-limits', async () => {
    try {
      return settingsManager?.getCostLimits();
    } catch (error) {
      console.error('コスト制限取得エラー:', error);
      throw error;
    }
  });

  // コスト制限設定
  ipcMain.handle('llm-settings:set-cost-limits', async (event, limits) => {
    try {
      settingsManager?.setCostLimits(limits);
      return { success: true };
    } catch (error) {
      console.error('コスト制限設定エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // 今日のコスト取得
  ipcMain.handle('llm-settings:get-today-cost', async () => {
    try {
      return settingsManager?.getTodayCost() || 0;
    } catch (error) {
      console.error('今日のコスト取得エラー:', error);
      throw error;
    }
  });

  // 今月のコスト取得
  ipcMain.handle('llm-settings:get-monthly-cost', async () => {
    try {
      return settingsManager?.getMonthlyCost() || 0;
    } catch (error) {
      console.error('今月のコスト取得エラー:', error);
      throw error;
    }
  });

  // プロバイダー別コスト統計取得
  ipcMain.handle('llm-settings:get-provider-cost-stats', async (event, days = 30) => {
    try {
      const stats = settingsManager?.getProviderCostStats(days);
      return Array.from(stats?.entries() || []);
    } catch (error) {
      console.error('プロバイダー別コスト統計取得エラー:', error);
      throw error;
    }
  });

  // 設定リセット
  ipcMain.handle('llm-settings:reset-settings', async () => {
    try {
      settingsManager?.resetSettings();
      return { success: true };
    } catch (error) {
      console.error('設定リセットエラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // 全データクリア
  ipcMain.handle('llm-settings:clear-all-data', async () => {
    try {
      settingsManager?.clearAllData();
      return { success: true };
    } catch (error) {
      console.error('全データクリアエラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // イベントリスナーの設定
  if (settingsManager) {
    settingsManager.on('settingsUpdated', (settings) => {
      // レンダラープロセスに設定更新を通知
      // 実際の実装ではmainWindow?.webContents.sendを使用
    });

    settingsManager.on('apiKeyUpdated', (apiKey) => {
      // APIキー更新通知
    });

    settingsManager.on('localModelAdded', (model) => {
      // ローカルモデル追加通知
    });

    settingsManager.on('costLimitExceeded', (data) => {
      // コスト制限超過通知
    });

    settingsManager.on('error', (error) => {
      console.error('LLM設定管理エラー:', error);
    });
  }
}

export function getLLMSettingsManager(): LLMSettingsManager | null {
  return settingsManager;
}

export function cleanupLLMSettingsHandlers(): void {
  if (settingsManager) {
    settingsManager.removeAllListeners();
    settingsManager = null;
  }
} 

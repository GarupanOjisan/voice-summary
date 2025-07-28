import React, { useState, useEffect } from 'react';

interface STTProfile {
  id: string;
  name: string;
  description?: string;
  engineConfig: any;
  defaultOptions: any;
  createdAt: Date;
  updatedAt: Date;
}

interface STTServiceStatus {
  isInitialized: boolean;
  isStreaming: boolean;
  currentProfile: STTProfile | null;
  engineStatus: any;
  errorStats: any;
  uptime: number;
}

interface STTErrorStats {
  totalErrors: number;
  errorsByType: { [key: string]: number };
  errorsBySeverity: { [key: string]: number };
  errorsByProvider: { [key: string]: number };
  recentErrors: any[];
  averageRecoveryTime: number;
  lastError?: any;
}

const STTEngineSetup: React.FC = () => {
  const [serviceStatus, setServiceStatus] = useState<STTServiceStatus | null>(null);
  const [profiles, setProfiles] = useState<STTProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<STTProfile | null>(null);
  const [errorStats, setErrorStats] = useState<STTErrorStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('');

  useEffect(() => {
    loadSTTEngineData();
  }, []);

  const loadSTTEngineData = async () => {
    try {
      setLoading(true);
      const [status, profilesList, current, errors, recent] = await Promise.all([
        window.electronAPI.getSttServiceStatus(),
        window.electronAPI.getSttProfiles(),
        window.electronAPI.getCurrentSttProfile(),
        window.electronAPI.getSttErrorStats(),
        window.electronAPI.getRecentSttErrors(10)
      ]);

      setServiceStatus(status);
      setProfiles(profilesList);
      setCurrentProfile(current);
      setErrorStats(errors);
      setRecentErrors(recent);
      setSelectedProfile(current?.id || '');

    } catch (err) {
      setError('STTエンジンデータの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeService = async () => {
    try {
      setError(null);
      const result = await window.electronAPI.initializeSttService();
      
      if (result.success) {
        await loadSTTEngineData();
        alert('STTサービスを初期化しました');
      } else {
        setError(`初期化に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('STTサービス初期化中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    try {
      setError(null);
      const result = await window.electronAPI.switchSttProfile(profileId);
      
      if (result.success) {
        await loadSTTEngineData();
        alert(`プロファイルを切り替えました`);
      } else {
        setError(`切り替えに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロファイル切り替え中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleCreateProfile = async () => {
    const name = prompt('プロファイル名を入力してください:');
    if (!name) return;

    const description = prompt('説明を入力してください（オプション）:');
    
    try {
      setError(null);
      
      // デフォルトのエンジン設定
      const engineConfig = {
        defaultProvider: 'whisper_local',
        providers: {
          whisper_local: {
            apiKey: '',
            language: 'ja',
            sampleRate: 16000,
            channels: 1,
          },
        },
        autoSwitch: true,
        fallbackProvider: 'whisper_local',
        retryAttempts: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 5,
      };

      const defaultOptions = {
        language: 'ja',
        model: 'base',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        confidenceThreshold: 0.7,
      };

      const result = await window.electronAPI.createSttProfile(name, engineConfig, defaultOptions, description || undefined);
      
      if (result.success) {
        await loadSTTEngineData();
        alert(`プロファイル "${name}" を作成しました`);
      } else {
        setError(`作成に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロファイル作成中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('このプロファイルを削除しますか？')) return;

    try {
      setError(null);
      const result = await window.electronAPI.deleteSttProfile(profileId);
      
      if (result.success) {
        await loadSTTEngineData();
        alert('プロファイルを削除しました');
      } else {
        setError(`削除に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロファイル削除中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleExportProfile = async (profileId: string) => {
    try {
      const result = await window.electronAPI.exportSttProfile(profileId);
      
      if (result.success && result.data) {
        // クリップボードにコピー
        await navigator.clipboard.writeText(result.data);
        alert('プロファイルをクリップボードにコピーしました');
      } else {
        setError(`エクスポートに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロファイルエクスポート中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleImportProfile = async () => {
    const profileData = prompt('プロファイルデータを貼り付けてください:');
    if (!profileData) return;

    try {
      setError(null);
      const result = await window.electronAPI.importSttProfile(profileData);
      
      if (result.success) {
        await loadSTTEngineData();
        alert('プロファイルをインポートしました');
      } else {
        setError(`インポートに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロファイルインポート中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleClearErrors = async () => {
    if (!confirm('すべてのエラーをクリアしますか？')) return;

    try {
      setError(null);
      const result = await window.electronAPI.clearSttErrors();
      
      if (result.success) {
        await loadSTTEngineData();
        alert('エラーをクリアしました');
      } else {
        setError(`クリアに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('エラークリア中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setError(null);
      const result = await window.electronAPI.saveSttConfig();
      
      if (result.success) {
        alert('設定を保存しました');
      } else {
        setError(`保存に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('設定保存中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleResetConfig = async () => {
    if (!confirm('設定をリセットしますか？すべてのプロファイルが削除されます。')) return;

    try {
      setError(null);
      const result = await window.electronAPI.resetSttConfig();
      
      if (result.success) {
        await loadSTTEngineData();
        alert('設定をリセットしました');
      } else {
        setError(`リセットに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('設定リセット中にエラーが発生しました');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        STTエンジン抽象化設定
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* サービス状態 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          サービス状態
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${serviceStatus?.isInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              初期化状態: {serviceStatus?.isInitialized ? '初期化済み' : '未初期化'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${serviceStatus?.isStreaming ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              ストリーミング: {serviceStatus?.isStreaming ? '実行中' : '停止中'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium">
              稼働時間: {Math.floor((serviceStatus?.uptime || 0) / 1000)}秒
            </span>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleInitializeService}
            disabled={serviceStatus?.isInitialized}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {serviceStatus?.isInitialized ? '初期化済み' : 'サービス初期化'}
          </button>
        </div>
      </div>

      {/* プロファイル管理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">
            プロファイル管理
          </h3>
          <div className="space-x-2">
            <button
              onClick={handleCreateProfile}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
            >
              新規作成
            </button>
            <button
              onClick={handleImportProfile}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              インポート
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-800">
                    {profile.name}
                    {currentProfile?.id === profile.id && (
                      <span className="ml-2 text-green-600 text-sm">(現在)</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {profile.description || '説明なし'}
                  </div>
                  <div className="text-xs text-gray-500">
                    作成日: {new Date(profile.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {currentProfile?.id !== profile.id && (
                    <button
                      onClick={() => handleSwitchProfile(profile.id)}
                      className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                    >
                      切り替え
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleExportProfile(profile.id)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                  >
                    エクスポート
                  </button>
                  
                  {currentProfile?.id !== profile.id && (
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* エラー統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">
            エラー統計
          </h3>
          <button
            onClick={handleClearErrors}
            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
          >
            エラーをクリア
          </button>
        </div>
        
        {errorStats && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm font-medium text-gray-700">総エラー数</div>
                <div className="text-2xl font-bold text-red-600">{errorStats.totalErrors}</div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm font-medium text-gray-700">平均復旧時間</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(errorStats.averageRecoveryTime)}ms
                </div>
              </div>
            </div>
            
            {errorStats.lastError && (
              <div className="bg-red-50 border border-red-200 p-3 rounded">
                <div className="text-sm font-medium text-red-700">最新エラー</div>
                <div className="text-sm text-red-600">{errorStats.lastError.message}</div>
                <div className="text-xs text-red-500">
                  {new Date(errorStats.lastError.timestamp).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 最近のエラー */}
      {recentErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            最近のエラー
          </h3>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentErrors.map((error, index) => (
              <div key={index} className="border border-gray-200 p-3 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {error.type} ({error.severity})
                    </div>
                    <div className="text-sm text-gray-600">{error.message}</div>
                    {error.provider && (
                      <div className="text-xs text-gray-500">プロバイダー: {error.provider}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(error.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 設定管理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          設定管理
        </h3>
        
        <div className="space-x-3">
          <button
            onClick={handleSaveConfig}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            設定を保存
          </button>
          
          <button
            onClick={handleResetConfig}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            設定をリセット
          </button>
        </div>
      </div>
    </div>
  );
};

export default STTEngineSetup; 

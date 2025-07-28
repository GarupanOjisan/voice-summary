import React, { useState, useEffect } from 'react';

interface STTProviderInfo {
  name: string;
  description: string;
  features: string[];
  pricing: string;
  supportedLanguages: string[];
  supportedModels: string[];
}

interface STTProviderStatus {
  type: string;
  name: string;
  isInitialized: boolean;
  isStreaming: boolean;
  isAvailable: boolean;
  lastError?: string;
}



const STTProviderSetup: React.FC = () => {
  const [supportedProviders, setSupportedProviders] = useState<string[]>([]);
  const [providerInfos, setProviderInfos] = useState<{ [key: string]: STTProviderInfo }>({});
  const [providerStatuses, setProviderStatuses] = useState<STTProviderStatus[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('whisper_local');


  useEffect(() => {
    loadSTTData();
  }, []);

  const loadSTTData = async () => {
    try {
      setLoading(true);
      const [providers, statuses, current] = await Promise.all([
        window.electronAPI.getSupportedSttProviders(),
        window.electronAPI.getSttProviderStatus(),
        window.electronAPI.getCurrentSttProvider()
      ]);

      setSupportedProviders(providers);
      setProviderStatuses(statuses);
      setCurrentProvider(current);

      // 各プロバイダーの情報を取得
      const infos: { [key: string]: STTProviderInfo } = {};
      for (const provider of providers) {
        try {
          const info = await window.electronAPI.getSttProviderInfo(provider);
          infos[provider] = info;
        } catch (err) {
          console.error(`プロバイダー ${provider} の情報取得に失敗:`, err);
        }
      }
      setProviderInfos(infos);

    } catch (err) {
      setError('STTデータの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeProvider = async (providerType: string) => {
    try {
      setError(null);
      const result = await window.electronAPI.initializeSttProvider(providerType);
      
      if (result.success) {
        await loadSTTData(); // データを再読み込み
        alert(`${providerType}プロバイダーを初期化しました`);
      } else {
        setError(`初期化に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロバイダー初期化中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleSwitchProvider = async (providerType: string) => {
    try {
      setError(null);
      const result = await window.electronAPI.switchSttProvider(providerType);
      
      if (result.success) {
        await loadSTTData(); // データを再読み込み
        alert(`プロバイダーを ${providerType} に切り替えました`);
      } else {
        setError(`切り替えに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('プロバイダー切り替え中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleStartStreaming = async () => {
    try {
      setError(null);
      
      const options = {
        language: 'ja',
        interimResults: true,
        punctuate: true,
        smartFormat: true,
        diarize: false,
        speakerLabels: false
      };

      const result = await window.electronAPI.startSttStreaming(options);
      
      if (result.success) {
        alert('STTストリーミングを開始しました');
        await loadSTTData();
      } else {
        setError(`ストリーミング開始に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('ストリーミング開始中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleStopStreaming = async () => {
    try {
      setError(null);
      const result = await window.electronAPI.stopSttStreaming();
      
      if (result.success) {
        alert('STTストリーミングを停止しました');
        await loadSTTData();
      } else {
        setError(`ストリーミング停止に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('ストリーミング停止中にエラーが発生しました');
      console.error(err);
    }
  };

  const getProviderStatus = (providerType: string): STTProviderStatus | null => {
    return providerStatuses.find(status => status.type === providerType) || null;
  };

  const isStreamingActive = (): boolean => {
    return providerStatuses.some(status => status.isStreaming);
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
        STTプロバイダー設定
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 現在のプロバイダー状況 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          現在のプロバイダー状況
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${currentProvider ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              現在のプロバイダー: {currentProvider || '未設定'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${isStreamingActive() ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {isStreamingActive() ? 'ストリーミング実行中' : 'ストリーミング停止中'}
            </span>
          </div>

          {/* デバッグ情報 */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-700 mb-2">デバッグ情報:</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>現在のプロバイダー: {currentProvider || 'null'}</div>
              <div>サポートされているプロバイダー数: {supportedProviders.length}</div>
              <div>プロバイダー状態数: {providerStatuses.length}</div>
              <div>ストリーミングアクティブ: {isStreamingActive() ? 'true' : 'false'}</div>
              <div>プロバイダー詳細:</div>
              {providerStatuses.map((status, index) => (
                <div key={index} className="ml-2">
                  - {status.type}: 初期化={status.isInitialized ? 'true' : 'false'}, ストリーミング={status.isStreaming ? 'true' : 'false'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 利用可能なプロバイダー */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          利用可能なプロバイダー
        </h3>
        
        <div className="space-y-4">
          {supportedProviders.map((providerType) => {
            const status = getProviderStatus(providerType);
            const info = providerInfos[providerType];
            
            return (
              <div
                key={providerType}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-800">
                      {info?.name || providerType}
                    </div>
                    <div className="text-sm text-gray-600">
                      {info?.description || '説明なし'}
                    </div>
                    <div className="text-xs text-gray-500">
                      料金: {info?.pricing || '不明'}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* 初期化状況 */}
                    <div className={`w-3 h-3 rounded-full ${status?.isInitialized ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    
                    {/* ストリーミング状況 */}
                    <div className={`w-3 h-3 rounded-full ${status?.isStreaming ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    
                    {/* 現在のプロバイダー */}
                    {currentProvider === providerType && (
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    )}
                  </div>
                </div>
                
                {/* 機能一覧 */}
                {info?.features && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">機能:</div>
                    <div className="flex flex-wrap gap-1">
                      {info.features.map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {!status?.isInitialized && (
                    <button
                      onClick={() => handleInitializeProvider(providerType)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      初期化
                    </button>
                  )}
                  
                  {status?.isInitialized && currentProvider !== providerType && (
                    <button
                      onClick={() => handleSwitchProvider(providerType)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      切り替え
                    </button>
                  )}
                  
                  {currentProvider === providerType && (
                    <span className="text-green-600 text-sm font-medium">現在のプロバイダー</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ストリーミング制御 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          STTストリーミング制御
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${isStreamingActive() ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {isStreamingActive() ? '実行中' : '停止中'}
            </span>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleStartStreaming}
              disabled={!currentProvider || isStreamingActive()}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              ストリーミング開始
            </button>
            
            <button
              onClick={handleStopStreaming}
              disabled={!isStreamingActive()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              ストリーミング停止
            </button>
          </div>
        </div>
      </div>



      {/* プロバイダー詳細設定 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          プロバイダー詳細設定
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プロバイダー選択
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {supportedProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {providerInfos[provider]?.name || provider}
                </option>
              ))}
            </select>
          </div>
          
          {selectedProvider && providerInfos[selectedProvider] && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  言語
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {providerInfos[selectedProvider].supportedLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  モデル
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {providerInfos[selectedProvider].supportedModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default STTProviderSetup; 

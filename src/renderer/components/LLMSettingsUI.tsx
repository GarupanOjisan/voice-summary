import React, { useState, useEffect } from 'react';

interface LLMSettings {
  defaultProvider: string;
  providers: {
    [key: string]: any;
  };
  autoSwitch: boolean;
  fallbackProvider?: string;
  costLimit: {
    daily: number;
    monthly: number;
    enabled: boolean;
  };
  modelSettings: {
    [key: string]: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
  };
}

interface APIKeyInfo {
  provider: string;
  key: string;
  maskedKey: string;
  isValid: boolean;
  lastUsed: number;
  usageCount: number;
}

interface LocalModelInfo {
  id: string;
  name: string;
  provider: string;
  filePath: string;
  fileSize: number;
  downloadDate: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  status: 'not_downloaded' | 'downloading' | 'downloaded' | 'error';
}



interface LLMSettingsUIProps {
  onSettingsChange?: (settings: LLMSettings) => void;
}

const LLMSettingsUI: React.FC<LLMSettingsUIProps> = ({ onSettingsChange }) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'api-keys' | 'models' | 'costs'>('providers');
  const [settings, setSettings] = useState<LLMSettings>({
    defaultProvider: 'local_llama',
    providers: {},
    autoSwitch: true,
    fallbackProvider: 'local_llama',
    costLimit: {
      daily: 10.0,
      monthly: 100.0,
      enabled: true,
    },
    modelSettings: {},
  });
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([]);
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モックデータ
  const mockApiKeys: APIKeyInfo[] = [
    {
      provider: 'openai',
      key: 'sk-...',
      maskedKey: 'sk-****1234',
      isValid: true,
      lastUsed: Date.now() - 3600000,
      usageCount: 150,
    },
    {
      provider: 'gemini',
      key: 'AIza...',
      maskedKey: 'AIza****5678',
      isValid: true,
      lastUsed: Date.now() - 7200000,
      usageCount: 89,
    },
  ];

  const mockLocalModels: LocalModelInfo[] = [
    {
      id: 'llama-3-8b',
      name: 'Llama 3 8B',
      provider: 'local_llama',
      filePath: '/models/llama-3-8b.gguf',
      fileSize: 4.7 * 1024 * 1024 * 1024, // 4.7GB
      downloadDate: Date.now() - 86400000,
      isDownloaded: true,
      status: 'downloaded',
    },
    {
      id: 'llama-3-70b',
      name: 'Llama 3 70B',
      provider: 'local_llama',
      filePath: '/models/llama-3-70b.gguf',
      fileSize: 40 * 1024 * 1024 * 1024, // 40GB
      downloadDate: 0,
      isDownloaded: false,
      status: 'not_downloaded',
    },
  ];



  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // 実際の実装ではIPCを通じてメインプロセスからデータを取得
      setApiKeys(mockApiKeys);
      setLocalModels(mockLocalModels);
    } catch (err) {
      setError('設定の読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = (newSettings: Partial<LLMSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    onSettingsChange?.(updatedSettings);
  };

  const handleAPIKeyAdd = (provider: string, key: string) => {
    const newApiKey: APIKeyInfo = {
      provider,
      key,
      maskedKey: key.substring(0, 4) + '****' + key.substring(key.length - 4),
      isValid: true,
      lastUsed: Date.now(),
      usageCount: 0,
    };
    setApiKeys(prev => [...prev.filter(k => k.provider !== provider), newApiKey]);
  };

  const handleAPIKeyRemove = (provider: string) => {
    setApiKeys(prev => prev.filter(k => k.provider !== provider));
  };

  const handleModelDownload = (modelId: string) => {
    setLocalModels(prev => prev.map(model => 
      model.id === modelId 
        ? { ...model, status: 'downloading', downloadProgress: 0 }
        : model
    ));

    // モックダウンロードプロセス
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setLocalModels(prev => prev.map(model => 
        model.id === modelId 
          ? { ...model, downloadProgress: progress }
          : model
      ));

      if (progress >= 100) {
        clearInterval(interval);
        setLocalModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                status: 'downloaded', 
                isDownloaded: true, 
                downloadDate: Date.now(),
                downloadProgress: 100 
              }
            : model
        ));
      }
    }, 500);
  };

  const handleModelRemove = (modelId: string) => {
    setLocalModels(prev => prev.filter(model => model.id !== modelId));
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < sizes.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${sizes[unitIndex]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-600">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">エラー</div>
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">LLM設定・管理</h2>

      {/* タブ */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'providers', label: 'プロバイダー' },
            { id: 'api-keys', label: 'APIキー' },
            { id: 'models', label: 'ローカルモデル' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* プロバイダー設定 */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">プロバイダー設定</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  デフォルトプロバイダー
                </label>
                <select
                  value={settings.defaultProvider}
                  onChange={(e) => handleSettingsChange({ defaultProvider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI GPT</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="local_llama">Local Llama</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  フォールバックプロバイダー
                </label>
                <select
                  value={settings.fallbackProvider || ''}
                  onChange={(e) => handleSettingsChange({ fallbackProvider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">なし</option>
                  <option value="openai">OpenAI GPT</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="local_llama">Local Llama</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoSwitch"
                  checked={settings.autoSwitch}
                  onChange={(e) => handleSettingsChange({ autoSwitch: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoSwitch" className="ml-2 block text-sm text-gray-900">
                  エラー時に自動でフォールバックプロバイダーに切り替え
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APIキー管理 */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">APIキー管理</h3>
            
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.provider} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {apiKey.provider}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        apiKey.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {apiKey.isValid ? '有効' : '無効'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAPIKeyRemove(apiKey.provider)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      削除
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>キー: {apiKey.maskedKey}</div>
                    <div>最終使用: {formatDate(apiKey.lastUsed)}</div>
                    <div>使用回数: {apiKey.usageCount}回</div>
                  </div>
                </div>
              ))}

              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">新しいAPIキーを追加</h4>
                <div className="space-y-2">
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                  <input
                    type="password"
                    placeholder="APIキーを入力"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                    追加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ローカルモデル管理 */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">ローカルモデル管理</h3>
            
            <div className="space-y-4">
              {localModels.map((model) => (
                <div key={model.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{model.name}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        model.status === 'downloaded' ? 'bg-green-100 text-green-800' :
                        model.status === 'downloading' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {model.status === 'downloaded' ? 'ダウンロード済み' :
                         model.status === 'downloading' ? 'ダウンロード中' :
                         '未ダウンロード'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {model.status === 'downloading' && (
                        <div className="text-sm text-gray-600">
                          {model.downloadProgress}%
                        </div>
                      )}
                      {model.status === 'downloaded' && (
                        <button
                          onClick={() => handleModelRemove(model.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          削除
                        </button>
                      )}
                      {model.status === 'not_downloaded' && (
                        <button
                          onClick={() => handleModelDownload(model.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          ダウンロード
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>サイズ: {formatFileSize(model.fileSize)}</div>
                    {model.isDownloaded && (
                      <div>ダウンロード日: {formatDate(model.downloadDate)}</div>
                    )}
                    {model.status === 'downloading' && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${model.downloadProgress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default LLMSettingsUI; 

import React, { useState, useEffect } from 'react';

interface WhisperModel {
  name: string;
  size: string;
  url: string;
  filename: string;
  description: string;
}

interface WhisperSettings {
  model: string | null;
  isInitialized: boolean;
  modelsDir: string;
}



const WhisperSetup: React.FC = () => {
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [settings, setSettings] = useState<WhisperSettings | null>(null);

  const [_selectedModel, setSelectedModel] = useState<string>('base');
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWhisperData();
  }, []);

  const loadWhisperData = async () => {
    try {
      setLoading(true);
      const [modelsData, downloadedData, settingsData] = await Promise.all([
        window.electronAPI.getWhisperModels(),
        window.electronAPI.getDownloadedWhisperModels(),
        window.electronAPI.getWhisperSettings(),
      ]);

      setModels(modelsData);
      setDownloadedModels(downloadedData);
      setSettings(settingsData);

      if (settingsData.model) {
        setSelectedModel(settingsData.model);
      }
    } catch (err) {
      setError('Whisperデータの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadModel = async (modelName: string) => {
    try {
      setDownloading(modelName);
      setError(null);

      const result = await window.electronAPI.downloadWhisperModel(modelName);

      if (result.success) {
        await loadWhisperData(); // データを再読み込み
        alert(`${modelName}モデルのダウンロードが完了しました`);
      } else {
        setError(`ダウンロードに失敗: ${result.error}`);
      }
    } catch (err) {
      setError('モデルダウンロード中にエラーが発生しました');
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const handleInitializeWhisper = async (modelName: string) => {
    try {
      setError(null);
      const result = await window.electronAPI.initializeWhisper(modelName);

      if (result.success) {
        await loadWhisperData(); // 設定を再読み込み
        alert(`${modelName}モデルでWhisperを初期化しました`);
      } else {
        setError(`初期化に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('Whisper初期化中にエラーが発生しました');
      console.error(err);
    }
  };



  const isModelDownloaded = (modelName: string): boolean => {
    return downloadedModels.some((model) => model.includes(modelName));
  };

  const isModelInitialized = (modelName: string): boolean => {
    return settings?.model === modelName && settings?.isInitialized === true;
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
        音声認識設定
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Whisper設定状況 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Whisper設定状況
        </h3>

        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div
              className={`w-4 h-4 rounded-full ${settings?.isInitialized ? 'bg-green-500' : 'bg-red-500'}`}
            ></div>
            <span className="text-sm font-medium">
              {settings?.isInitialized ? '初期化済み' : '未初期化'}
            </span>
          </div>

          {settings?.model && (
            <div className="text-sm text-gray-600">
              現在のモデル: {settings.model}
            </div>
          )}

          <div className="text-sm text-gray-600">
            モデルディレクトリ: {settings?.modelsDir}
          </div>

          {/* デバッグ情報 */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-700 mb-2">デバッグ情報:</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>isInitialized: {settings?.isInitialized ? 'true' : 'false'}</div>
              <div>currentModel: {settings?.model || 'null'}</div>
              <div>ダウンロード済みモデル数: {downloadedModels.length}</div>
              <div>baseモデルダウンロード済み: {isModelDownloaded('base') ? 'はい' : 'いいえ'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 利用可能なモデル */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          利用可能なモデル
        </h3>

        <div className="space-y-4">
          {models.map((model) => (
            <div
              key={model.name}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-800">{model.name}</div>
                  <div className="text-sm text-gray-600">
                    {model.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    サイズ: {model.size}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* ダウンロード状況 */}
                  <div
                    className={`w-3 h-3 rounded-full ${isModelDownloaded(model.name) ? 'bg-green-500' : 'bg-gray-300'}`}
                  ></div>

                  {/* 初期化状況 */}
                  {isModelDownloaded(model.name) && (
                    <div
                      className={`w-3 h-3 rounded-full ${isModelInitialized(model.name) ? 'bg-blue-500' : 'bg-gray-300'}`}
                    ></div>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                {!isModelDownloaded(model.name) && (
                  <button
                    onClick={() => handleDownloadModel(model.name)}
                    disabled={downloading === model.name}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {downloading === model.name
                      ? 'ダウンロード中...'
                      : 'ダウンロード'}
                  </button>
                )}

                {isModelDownloaded(model.name) &&
                  !isModelInitialized(model.name) && (
                    <button
                      onClick={() => handleInitializeWhisper(model.name)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      初期化
                    </button>
                  )}

                {isModelInitialized(model.name) && (
                  <span className="text-green-600 text-sm font-medium">
                    初期化済み
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>



      {/* 認識精度・レイテンシ最適化設定 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          認識精度・レイテンシ最適化
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              チャンク期間 (秒)
            </label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              defaultValue="2.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              オーバーラップ期間 (秒)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              defaultValue="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              温度 (Temperature)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              defaultValue="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              低い値ほど決定論的、高い値ほど創造的になります
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhisperSetup;

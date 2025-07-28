import React, { useState, useEffect } from 'react';

interface VirtualAudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output' | 'both';
  isActive: boolean;
  isVirtual: boolean;
}

interface InstallationGuide {
  title: string;
  description: string;
  steps: string[];
  downloadUrl: string;
}

interface AudioRoutingConfig {
  systemAudio: boolean;
  microphoneAudio: boolean;
  mixingMode: 'separate' | 'mixed';
  outputDevice: string;
}

const VirtualAudioDeviceSetup: React.FC = () => {
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [devices, setDevices] = useState<VirtualAudioDevice[]>([]);
  const [installationGuide, setInstallationGuide] =
    useState<InstallationGuide | null>(null);
  const [routingConfig, setRoutingConfig] = useState<AudioRoutingConfig | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVirtualAudioDeviceConfig();
    loadAudioRoutingConfig();
  }, []);

  const loadVirtualAudioDeviceConfig = async () => {
    try {
      setLoading(true);
      const config = await window.electronAPI.getVirtualAudioDeviceConfig();
      setIsInstalled(config.isInstalled);
      setDevices(config.devices);
      setInstallationGuide(config.installationGuide);
    } catch (err) {
      setError('仮想オーディオデバイス設定の読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAudioRoutingConfig = async () => {
    try {
      const config = await window.electronAPI.getAudioRoutingConfig();
      setRoutingConfig(config);
    } catch (err) {
      console.error('音声ルーティング設定の読み込みに失敗:', err);
    }
  };

  const handleCreateVirtualDevice = async () => {
    try {
      const result = await window.electronAPI.createVirtualAudioDevice();
      if (result.success) {
        alert(result.message);
        await loadVirtualAudioDeviceConfig();
      } else {
        alert(`仮想オーディオデバイスの作成に失敗: ${result.message}`);
      }
    } catch (err) {
      alert('仮想オーディオデバイスの作成中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleStartVirtualCapture = async (deviceName: string) => {
    try {
      const result =
        await window.electronAPI.startVirtualAudioCapture(deviceName);
      if (result.success) {
        alert(`${deviceName} からの音声キャプチャを開始しました`);
      } else {
        alert(`仮想オーディオデバイスキャプチャの開始に失敗: ${result.error}`);
      }
    } catch (err) {
      alert('仮想オーディオデバイスキャプチャの開始中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleStartMixedCapture = async () => {
    if (!routingConfig) return;

    try {
      const systemDevice = 'BlackHole 2ch'; // 仮想オーディオデバイス
      const micDevice = 'Built-in Microphone'; // 内蔵マイク（実際のデバイス名に応じて変更）

      const result = await window.electronAPI.startMixedAudioCapture(
        systemDevice,
        micDevice
      );
      if (result.success) {
        alert('システム音声とマイク音声の混合キャプチャを開始しました');
      } else {
        alert(`混合音声キャプチャの開始に失敗: ${result.error}`);
      }
    } catch (err) {
      alert('混合音声キャプチャの開始中にエラーが発生しました');
      console.error(err);
    }
  };

  const handleUpdateRouting = async (
    newConfig: Partial<AudioRoutingConfig>
  ) => {
    if (!routingConfig) return;

    const updatedConfig = { ...routingConfig, ...newConfig };
    try {
      const result = await window.electronAPI.updateAudioRouting(updatedConfig);
      if (result.success) {
        setRoutingConfig(updatedConfig);
        alert('音声ルーティング設定を更新しました');
      } else {
        alert(`設定の更新に失敗: ${result.error}`);
      }
    } catch (err) {
      alert('音声ルーティング設定の更新中にエラーが発生しました');
      console.error(err);
    }
  };

  const openDownloadUrl = () => {
    if (installationGuide?.downloadUrl) {
      window.open(installationGuide.downloadUrl, '_blank');
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
        仮想オーディオデバイス設定
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* BlackHoleインストール状況 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          BlackHole仮想オーディオドライバ
        </h3>

        <div className="flex items-center space-x-4 mb-4">
          <div
            className={`w-4 h-4 rounded-full ${isInstalled ? 'bg-green-500' : 'bg-red-500'}`}
          ></div>
          <span className="text-sm font-medium">
            {isInstalled ? 'インストール済み' : '未インストール'}
          </span>
        </div>

        {!isInstalled && installationGuide && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-800 mb-2">
              {installationGuide.title}
            </h4>
            <p className="text-blue-700 mb-4">
              {installationGuide.description}
            </p>

            <div className="space-y-2 mb-4">
              {installationGuide.steps.map((step, index) => (
                <div key={index} className="text-sm text-blue-700">
                  {step}
                </div>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={openDownloadUrl}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                ダウンロード
              </button>
              <button
                onClick={handleCreateVirtualDevice}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                インストール確認
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 仮想オーディオデバイス一覧 */}
      {devices.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            検出された仮想オーディオデバイス
          </h3>

          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-800">{device.name}</div>
                  <div className="text-sm text-gray-600">
                    タイプ: {device.type} | 状態:{' '}
                    {device.isActive ? 'アクティブ' : '非アクティブ'}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <button
                    onClick={() => handleStartVirtualCapture(device.name)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    キャプチャ開始
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 音声ルーティング設定 */}
      {routingConfig && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            音声ルーティング設定
          </h3>

          <div className="space-y-4">
            {/* システム音声 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">システム音声</div>
                <div className="text-sm text-gray-600">
                  Zoom、ブラウザなどの音声をキャプチャ
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={routingConfig.systemAudio}
                  onChange={(e) =>
                    handleUpdateRouting({ systemAudio: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* マイク音声 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">マイク音声</div>
                <div className="text-sm text-gray-600">
                  マイクからの音声をキャプチャ
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={routingConfig.microphoneAudio}
                  onChange={(e) =>
                    handleUpdateRouting({ microphoneAudio: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 混合モード */}
            <div>
              <div className="font-medium text-gray-800 mb-2">混合モード</div>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mixingMode"
                    value="mixed"
                    checked={routingConfig.mixingMode === 'mixed'}
                    onChange={(e) =>
                      handleUpdateRouting({
                        mixingMode: e.target.value as 'mixed' | 'separate',
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">混合</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mixingMode"
                    value="separate"
                    checked={routingConfig.mixingMode === 'separate'}
                    onChange={(e) =>
                      handleUpdateRouting({
                        mixingMode: e.target.value as 'mixed' | 'separate',
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">分離</span>
                </label>
              </div>
            </div>

            {/* 出力デバイス */}
            <div>
              <div className="font-medium text-gray-800 mb-2">出力デバイス</div>
              <input
                type="text"
                value={routingConfig.outputDevice}
                onChange={(e) =>
                  handleUpdateRouting({ outputDevice: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="出力デバイス名"
              />
            </div>

            {/* 混合キャプチャ開始ボタン */}
            <div className="pt-4">
              <button
                onClick={handleStartMixedCapture}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                システム音声 + マイク音声の混合キャプチャ開始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualAudioDeviceSetup;

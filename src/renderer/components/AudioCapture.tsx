import React, { useState, useEffect } from 'react';

interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
}

interface AudioCaptureProps {
  onAudioData?: (data: Buffer) => void;
}

export const AudioCapture: React.FC<AudioCaptureProps> = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadAudioDevices();
  }, []);

  const loadAudioDevices = async () => {
    try {
      const audioDevices = await window.electronAPI.getAudioDevices();
      setDevices(audioDevices);
      if (audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].id);
      }
    } catch (err) {
      setError('音声デバイスの取得に失敗しました');
      console.error('音声デバイス取得エラー:', err);
    }
  };

  const startCapture = async () => {
    if (!selectedDevice) {
      setError('音声デバイスを選択してください');
      return;
    }

    try {
      setError('');
      const result = await window.electronAPI.startAudioCapture(selectedDevice);

      if (result.success) {
        setIsCapturing(true);
        console.log('音声キャプチャを開始しました');
      } else {
        setError(result.error || '音声キャプチャの開始に失敗しました');
      }
    } catch (err) {
      setError('音声キャプチャの開始に失敗しました');
      console.error('音声キャプチャ開始エラー:', err);
    }
  };

  const stopCapture = async () => {
    try {
      const result = await window.electronAPI.stopAudioCapture();

      if (result.success) {
        setIsCapturing(false);
        setAudioLevel(0);
        console.log('音声キャプチャを停止しました');
      } else {
        setError(result.error || '音声キャプチャの停止に失敗しました');
      }
    } catch (err) {
      setError('音声キャプチャの停止に失敗しました');
      console.error('音声キャプチャ停止エラー:', err);
    }
  };

  // 音声レベルメーターのアニメーション
  useEffect(() => {
    if (isCapturing) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isCapturing]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">音声キャプチャ</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 音声デバイス選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            音声デバイス
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCapturing}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        {/* 音声レベルメーター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            音声レベル
          </label>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {Math.round(audioLevel)}%
          </div>
        </div>

        {/* 制御ボタン */}
        <div className="flex space-x-4">
          <button
            onClick={startCapture}
            disabled={isCapturing || !selectedDevice}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCapturing ? 'キャプチャ中...' : 'キャプチャ開始'}
          </button>

          <button
            onClick={stopCapture}
            disabled={!isCapturing}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            キャプチャ停止
          </button>
        </div>

        {/* 状態表示 */}
        <div className="text-sm text-gray-600">
          状態: {isCapturing ? 'キャプチャ中' : '停止中'}
        </div>
      </div>
    </div>
  );
};

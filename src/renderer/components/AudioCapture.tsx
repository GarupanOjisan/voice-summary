import React, { useState, useEffect } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';

interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
}

interface AudioCaptureProps {
  // プロパティは必要に応じて追加
}

export const AudioCapture: React.FC<AudioCaptureProps> = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string>('');
  
  // transcriptionStoreから状態管理機能を取得
  const { setSTTActive } = useTranscriptionStore();

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



  // 実際の音声レベルデータを取得
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const level = await window.electronAPI.getAudioLevel();
        setAudioLevel(level);
      } catch (error) {
        console.error('音声レベル取得エラー:', error);
        setAudioLevel(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

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




      </div>
    </div>
  );
};

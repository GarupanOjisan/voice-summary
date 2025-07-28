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
  const [isCapturing, setIsCapturing] = useState(false);
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

  const startCapture = async () => {
    try {
      setError('');
      
      // 内蔵マイクキャプチャを使用（混合音声キャプチャの代わりに）
      const result = await window.electronAPI.startMicrophoneCapture();

      if (result.success) {
        setIsCapturing(true);
        console.log('内蔵マイク音声キャプチャを開始しました');
        
        // STTストリーミング状態を手動でtrueに設定（デバッグ用）
        console.log('🔴 STTストリーミング状態を手動でtrueに設定します');
        setSTTActive(true);
      } else {
        console.error('音声キャプチャ開始失敗:', result.error);
        setError(result.error || '音声キャプチャの開始に失敗しました');
      }
    } catch (err) {
      console.error('音声キャプチャ開始エラー:', err);
      setError('音声キャプチャの開始に失敗しました');
    }
  };

  const stopCapture = async () => {
    try {
      setError('');
      const result = await window.electronAPI.stopAudioCapture();

      if (result.success) {
        setIsCapturing(false);
        console.log('音声キャプチャを停止しました');
        
        // STTストリーミング状態を手動でfalseに設定
        console.log('🔴 STTストリーミング状態を手動でfalseに設定します');
        setSTTActive(false);
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

        {/* ボタン群 */}
        <div className="flex space-x-2">
          <button
            onClick={startCapture}
            disabled={isCapturing}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            キャプチャ開始
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

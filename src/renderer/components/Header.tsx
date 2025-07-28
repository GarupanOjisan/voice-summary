import React, { useState } from 'react';
import { useAudioStore } from '../stores';
import { useTranscriptionStore } from '../stores/transcriptionStore';

const Header: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { isRecording, startRecording, stopRecording } = useAudioStore();
  const { setSTTActive } = useTranscriptionStore();

  const handleToggleRecording = async () => {
    if (isRecording) {
      try {
        await window.electronAPI.stopAudioCapture();
        stopRecording();
        setSTTActive(false);
      } catch (error) {
        console.error('録音停止エラー:', error);
      }
    } else {
      try {
        // 内蔵マイクキャプチャを開始
        const result = await window.electronAPI.startMicrophoneCapture();
        if (result.success) {
          startRecording();
          setSTTActive(true);
          console.log('内蔵マイク録音を開始しました');
        } else {
          console.error('録音開始エラー:', result.error);
        }
      } catch (error) {
        console.error('録音開始エラー:', error);
      }
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* ロゴとタイトル */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">VS</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Voice Summary</h1>
        </div>

        {/* 中央のコントロール */}
        <div className="flex items-center space-x-4">
          {/* 録音ボタン */}
          <button
            onClick={handleToggleRecording}
            className={`flex items-center space-x-2 px-6 py-2 rounded-full font-medium transition-all duration-200 ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
            }`}
          >
            <div className={`w-3 h-3 rounded-full ${
              isRecording ? 'bg-white animate-pulse' : 'bg-white'
            }`}></div>
            <span>{isRecording ? '録音停止' : '録音開始'}</span>
          </button>

          {/* 録音時間表示 */}
          {isRecording && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>録音中...</span>
            </div>
          )}
        </div>

        {/* 右側のアクション */}
        <div className="flex items-center space-x-3">
          {/* エクスポートボタン */}
          <button
            onClick={() => console.log('Export clicked')}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span>📤</span>
            <span>エクスポート</span>
          </button>

          {/* 設定ボタン */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>⚙️</span>
              <span>設定</span>
            </button>

            {/* ドロップダウンメニュー */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    console.log('Settings clicked');
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  📋 一般設定
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  🎤 音声設定
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  🤖 AI設定
                </button>
                <hr className="my-2" />
                <button
                  onClick={() => setShowDropdown(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  ❓ ヘルプ
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  ℹ️ バージョン情報
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 

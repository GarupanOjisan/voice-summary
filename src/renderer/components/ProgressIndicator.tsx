import React, { useState, useEffect } from 'react';
import { useAudioStore, useTranscriptionStore, useSummaryStore } from '../stores';

interface ProgressIndicatorProps {
  showDetails?: boolean;
  showTimeline?: boolean;
  compact?: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  showDetails = true,
  showTimeline = true,
  compact = false,
}) => {
  const { isRecording, recordingDuration, audioLevel, isAudioDetected } = useAudioStore();
  const { isSTTActive, isProcessing, processingQueue, totalWords, averageConfidence } = useTranscriptionStore();
  const { isGenerating, generationProgress, totalSummaries } = useSummaryStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());

  // 現在時刻の更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (isActive: boolean): string => {
    return isActive ? 'bg-green-500' : 'bg-gray-400';
  };

  const getProgressPercentage = (): number => {
    if (!isRecording) return 0;
    
    // 録音時間に基づく進行度（例：1時間で100%）
    const maxDuration = 3600; // 1時間
    return Math.min((recordingDuration / maxDuration) * 100, 100);
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(isRecording)}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isRecording ? '録音中' : '停止中'}
            </span>
            {isRecording && (
              <span className="text-sm text-gray-500">
                {formatDuration(recordingDuration)}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(isSTTActive)}`}></div>
            <span className="text-xs text-gray-500">STT</span>
            <div className={`w-2 h-2 rounded-full ${getStatusColor(isGenerating)}`}></div>
            <span className="text-xs text-gray-500">AI</span>
          </div>
        </div>
        
        {isRecording && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">進行状況</h3>
        <div className="text-sm text-gray-500">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>

      {/* メインステータス */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* 録音ステータス */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">録音</span>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(isRecording)}`}></div>
          </div>
          <div className="text-lg font-semibold text-blue-900">
            {isRecording ? formatDuration(recordingDuration) : '停止中'}
          </div>
          {isRecording && (
            <div className="text-xs text-blue-600 mt-1">
              音声レベル: {Math.round(audioLevel.current * 100)}%
            </div>
          )}
        </div>

        {/* STTステータス */}
        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-800">音声認識</span>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(isSTTActive)}`}></div>
          </div>
          <div className="text-lg font-semibold text-green-900">
            {totalWords}語
          </div>
          {isSTTActive && (
            <div className="text-xs text-green-600 mt-1">
              信頼度: {(averageConfidence * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* AI要約ステータス */}
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-800">AI要約</span>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(isGenerating)}`}></div>
          </div>
          <div className="text-lg font-semibold text-purple-900">
            {totalSummaries}件
          </div>
          {isGenerating && (
            <div className="text-xs text-purple-600 mt-1">
              生成中: {Math.round(generationProgress)}%
            </div>
          )}
        </div>
      </div>

      {/* 詳細情報 */}
      {showDetails && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">詳細情報</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-500">音声検出:</span>
              <span className={`ml-1 ${isAudioDetected ? 'text-green-600' : 'text-gray-400'}`}>
                {isAudioDetected ? 'あり' : 'なし'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">処理キュー:</span>
              <span className="ml-1 text-gray-700">{processingQueue}</span>
            </div>
            <div>
              <span className="text-gray-500">処理中:</span>
              <span className={`ml-1 ${isProcessing ? 'text-orange-600' : 'text-gray-400'}`}>
                {isProcessing ? 'はい' : 'いいえ'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">平均信頼度:</span>
              <span className="ml-1 text-gray-700">
                {(averageConfidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* タイムライン */}
      {showTimeline && isRecording && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">進行状況</h4>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>開始</span>
            <span>{getProgressPercentage().toFixed(1)}%</span>
            <span>完了</span>
          </div>
        </div>
      )}

      {/* リアルタイムインジケーター */}
      <div className="flex items-center justify-center space-x-2 mt-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-gray-500">リアルタイム更新中</span>
      </div>
    </div>
  );
};

export default ProgressIndicator; 

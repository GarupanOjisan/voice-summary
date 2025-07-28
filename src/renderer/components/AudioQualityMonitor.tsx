import React, { useState, useEffect } from 'react';

interface AudioQualityStats {
  currentLevel: number;
  averageLevel: number;
  peakLevel: number;
  silencePercentage: number;
  bufferUtilization: number;
}

interface BufferInfo {
  size: number;
  chunks: number;
  maxSize: number;
  utilization: number;
}

export const AudioQualityMonitor: React.FC = () => {
  const [qualityStats, setQualityStats] = useState<AudioQualityStats | null>(
    null
  );
  const [bufferInfo, setBufferInfo] = useState<BufferInfo | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(async () => {
        try {
          const stats = await window.electronAPI.getAudioQualityStats();
          const buffer = await window.electronAPI.getBufferInfo();

          if (stats) {
            setQualityStats(stats);
          }
          if (buffer) {
            setBufferInfo(buffer);
          }
        } catch (error) {
          console.error('音声品質統計取得エラー:', error);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isMonitoring]);

  const startMonitoring = () => {
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getLevelColor = (level: number): string => {
    if (level < 20) return 'bg-green-500';
    if (level < 60) return 'bg-yellow-500';
    if (level < 80) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getBufferColor = (utilization: number): string => {
    if (utilization < 50) return 'bg-green-500';
    if (utilization < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">音声品質監視</h2>
        <div className="flex space-x-2">
          <button
            onClick={startMonitoring}
            disabled={isMonitoring}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
          >
            監視開始
          </button>
          <button
            onClick={stopMonitoring}
            disabled={!isMonitoring}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:bg-gray-400"
          >
            監視停止
          </button>
        </div>
      </div>

      {qualityStats && (
        <div className="space-y-4">
          {/* 音声レベル */}
          <div>
            <h3 className="text-lg font-medium mb-2">音声レベル</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  現在のレベル
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-100 ${getLevelColor(qualityStats.currentLevel)}`}
                      style={{ width: `${qualityStats.currentLevel}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12">
                    {qualityStats.currentLevel.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  平均レベル
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-100 ${getLevelColor(qualityStats.averageLevel)}`}
                      style={{ width: `${qualityStats.averageLevel}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12">
                    {qualityStats.averageLevel.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ピークレベル
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-100 ${getLevelColor(qualityStats.peakLevel)}`}
                      style={{ width: `${qualityStats.peakLevel}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12">
                    {qualityStats.peakLevel.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* バッファ情報 */}
          {bufferInfo && (
            <div>
              <h3 className="text-lg font-medium mb-2">バッファ情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    バッファ使用率
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all duration-100 ${getBufferColor(bufferInfo.utilization)}`}
                        style={{ width: `${bufferInfo.utilization}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12">
                      {bufferInfo.utilization.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    バッファサイズ
                  </label>
                  <div className="text-sm text-gray-600">
                    {formatBytes(bufferInfo.size)} /{' '}
                    {formatBytes(bufferInfo.maxSize)}
                  </div>
                  <div className="text-xs text-gray-500">
                    チャンク数: {bufferInfo.chunks}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 統計情報 */}
          <div>
            <h3 className="text-lg font-medium mb-2">統計情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  無音率
                </label>
                <div className="text-sm text-gray-600">
                  {qualityStats.silencePercentage.toFixed(1)}%
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  監視状態
                </label>
                <div className="text-sm text-gray-600">
                  {isMonitoring ? (
                    <span className="text-green-600">監視中</span>
                  ) : (
                    <span className="text-gray-500">停止中</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!qualityStats && (
        <div className="text-center text-gray-500 py-8">
          監視を開始すると音声品質情報が表示されます
        </div>
      )}
    </div>
  );
};

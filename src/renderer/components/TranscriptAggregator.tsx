import React, { useState, useEffect } from 'react';

interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
  isFinal: boolean;
  language?: string;
  timestamp: number;
}

interface AggregatedTranscript {
  id: string;
  segments: TranscriptSegment[];
  totalDuration: number;
  startTime: number;
  endTime: number;
  speakerCount: number;
  wordCount: number;
  averageConfidence: number;
  languages: string[];
}

interface SpeakerInfo {
  id: string;
  name?: string;
  color?: string;
  totalSegments: number;
  totalDuration: number;
  averageConfidence: number;
}

interface TranscriptAggregatorConfig {
  batchInterval: number;
  maxSegmentGap: number;
  minSegmentDuration: number;
  confidenceThreshold: number;
  enableSpeakerSeparation: boolean;
  enableAutoCleanup: boolean;
  cleanupInterval: number;
  maxSegmentsInMemory: number;
}

interface TranscriptAggregatorInfo {
  currentSession: {
    sessionId: string;
    startTime: number;
    isActive: boolean;
    segmentCount: number;
    speakerCount: number;
  };
  speakers: SpeakerInfo[];
  latestTranscript: AggregatedTranscript | null;
  config: TranscriptAggregatorConfig;
}

const TranscriptAggregator: React.FC = () => {
  const [aggregatorInfo, setAggregatorInfo] = useState<TranscriptAggregatorInfo | null>(null);
  const [aggregatedTranscripts, setAggregatedTranscripts] = useState<AggregatedTranscript[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [config, setConfig] = useState<TranscriptAggregatorConfig | null>(null);

  useEffect(() => {
    loadTranscriptData();
    const interval = setInterval(loadTranscriptData, 1000); // 1秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const loadTranscriptData = async () => {
    try {
      const [info, transcripts] = await Promise.all([
        window.electronAPI.getTranscriptAggregatorInfo(),
        window.electronAPI.getAggregatedTranscripts()
      ]);

      setAggregatorInfo(info);
      setAggregatedTranscripts(transcripts);
      setConfig(info?.config || null);
    } catch (err) {
      setError('トランスクリプトデータの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = async (updates: Partial<TranscriptAggregatorConfig>) => {
    if (!config) return;

    try {
      setError(null);
      const newConfig = { ...config, ...updates };
      const result = await window.electronAPI.updateTranscriptAggregatorConfig(newConfig);
      
      if (result.success) {
        setConfig(newConfig);
        alert('設定を更新しました');
      } else {
        setError(`設定更新に失敗: ${result.error}`);
      }
    } catch (err) {
      setError('設定更新中にエラーが発生しました');
      console.error(err);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800 font-medium">エラー</div>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* セッション情報 */}
      {aggregatorInfo && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              トランスクリプト集約セッション
            </h3>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showConfig ? '設定を隠す' : '設定を表示'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {aggregatorInfo.currentSession.isActive ? '実行中' : '停止中'}
              </div>
              <div className="text-sm text-gray-600">ステータス</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {aggregatorInfo.currentSession.segmentCount}
              </div>
              <div className="text-sm text-gray-600">セグメント数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {aggregatorInfo.currentSession.speakerCount}
              </div>
              <div className="text-sm text-gray-600">話者数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatDuration(Date.now() - aggregatorInfo.currentSession.startTime)}
              </div>
              <div className="text-sm text-gray-600">実行時間</div>
            </div>
          </div>

          {/* 設定パネル */}
          {showConfig && config && (
            <div className="border-t pt-4">
              <h4 className="text-md font-medium text-gray-700 mb-3">集約設定</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    バッチ間隔 (ms)
                  </label>
                  <input
                    type="number"
                    value={config.batchInterval}
                    onChange={(e) => handleConfigUpdate({ batchInterval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大セグメント間隔 (ms)
                  </label>
                  <input
                    type="number"
                    value={config.maxSegmentGap}
                    onChange={(e) => handleConfigUpdate({ maxSegmentGap: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最小セグメント時間 (ms)
                  </label>
                  <input
                    type="number"
                    value={config.minSegmentDuration}
                    onChange={(e) => handleConfigUpdate({ minSegmentDuration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    信頼度閾値
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.confidenceThreshold}
                    onChange={(e) => handleConfigUpdate({ confidenceThreshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enableSpeakerSeparation}
                    onChange={(e) => handleConfigUpdate({ enableSpeakerSeparation: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    話者分離を有効にする
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enableAutoCleanup}
                    onChange={(e) => handleConfigUpdate({ enableAutoCleanup: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    自動クリーンアップを有効にする
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 話者情報 */}
      {aggregatorInfo && aggregatorInfo.speakers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            話者情報
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aggregatorInfo.speakers.map((speaker) => (
              <div key={speaker.id} className="border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div
                    className="w-4 h-4 rounded-full mr-2"
                    style={{ backgroundColor: speaker.color }}
                  ></div>
                  <span className="font-medium text-gray-800">{speaker.name}</span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>セグメント数: {speaker.totalSegments}</div>
                  <div>総発話時間: {formatDuration(speaker.totalDuration)}</div>
                  <div>平均信頼度: {(speaker.averageConfidence * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最新の集約トランスクリプト */}
      {aggregatorInfo?.latestTranscript && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            最新の集約トランスクリプト
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatDuration(aggregatorInfo.latestTranscript.totalDuration)}
              </div>
              <div className="text-sm text-gray-600">総時間</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {aggregatorInfo.latestTranscript.wordCount}
              </div>
              <div className="text-sm text-gray-600">単語数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {aggregatorInfo.latestTranscript.speakerCount}
              </div>
              <div className="text-sm text-gray-600">話者数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(aggregatorInfo.latestTranscript.averageConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">平均信頼度</div>
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {aggregatorInfo.latestTranscript.segments.map((segment) => (
              <div key={segment.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {segment.speaker && (
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ 
                          backgroundColor: aggregatorInfo.speakers.find(s => s.id === segment.speaker)?.color 
                        }}
                      ></div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {segment.speaker ? 
                        aggregatorInfo.speakers.find(s => s.id === segment.speaker)?.name : 
                        '不明な話者'
                      }
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(segment.startTime)} - {formatTimestamp(segment.endTime)}
                  </div>
                </div>
                <div className="text-gray-800 mb-2">{segment.text}</div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>信頼度: {(segment.confidence * 100).toFixed(1)}%</span>
                  <span>{segment.isFinal ? '確定' : '仮確定'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 集約トランスクリプト履歴 */}
      {aggregatedTranscripts.length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            集約トランスクリプト履歴
          </h3>
          <div className="space-y-3">
            {aggregatedTranscripts.slice(0, -1).reverse().map((transcript) => (
              <div key={transcript.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">
                    セッション: {transcript.id}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(transcript.startTime)} - {formatTimestamp(transcript.endTime)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                  <div>時間: {formatDuration(transcript.totalDuration)}</div>
                  <div>単語数: {transcript.wordCount}</div>
                  <div>話者数: {transcript.speakerCount}</div>
                  <div>信頼度: {(transcript.averageConfidence * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptAggregator; 

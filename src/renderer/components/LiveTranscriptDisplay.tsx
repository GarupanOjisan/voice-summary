import React, { useState, useEffect, useRef } from 'react';

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

interface SpeakerInfo {
  id: string;
  name?: string;
  color?: string;
  totalSegments: number;
  totalDuration: number;
  averageConfidence: number;
}

interface LiveTranscriptDisplayProps {
  autoScroll?: boolean;
  showTimestamps?: boolean;
  showConfidence?: boolean;
  maxHeight?: string;
  refreshInterval?: number;
}

const LiveTranscriptDisplay: React.FC<LiveTranscriptDisplayProps> = ({
  autoScroll = true,
  showTimestamps = true,
  showConfidence = true,
  maxHeight = '600px',
  refreshInterval = 1000,
}) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySettings, setDisplaySettings] = useState({
    autoScroll,
    showTimestamps,
    showConfidence,
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSegmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTranscriptData();
    
    // 定期的な更新とイベントベースの更新を組み合わせ
    const interval = setInterval(loadTranscriptData, refreshInterval);
    
    // イベントベースの更新を設定
    const handleSegmentAdded = () => {
      loadTranscriptData();
    };
    
    const handleBatchProcessed = () => {
      loadTranscriptData();
    };
    
    const handleSessionStarted = () => {
      loadTranscriptData();
    };
    
    const handleSessionStopped = () => {
      loadTranscriptData();
    };
    
    window.electronAPI.onTranscriptSegmentAdded(handleSegmentAdded);
    window.electronAPI.onTranscriptBatchProcessed(handleBatchProcessed);
    window.electronAPI.onTranscriptSessionStarted(handleSessionStarted);
    window.electronAPI.onTranscriptSessionStopped(handleSessionStopped);
    
    return () => {
      clearInterval(interval);
    };
  }, [refreshInterval]);

  useEffect(() => {
    if (autoScroll && lastSegmentRef.current) {
      lastSegmentRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [segments, autoScroll]);

  const loadTranscriptData = async () => {
    try {
      const aggregatorInfo = await window.electronAPI.getTranscriptAggregatorInfo();
      
      if (aggregatorInfo) {
        setIsStreaming(aggregatorInfo.currentSession.isActive);
        setSpeakers(aggregatorInfo.speakers);
        
        if (aggregatorInfo.latestTranscript) {
          setSegments(aggregatorInfo.latestTranscript.segments);
        }
      }
    } catch (err) {
      setError('トランスクリプトデータの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime: number, endTime: number): string => {
    const duration = endTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  const getSpeakerColor = (speakerId: string): string => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker?.color || '#6B7280';
  };

  const getSpeakerName = (speakerId: string): string => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker?.name || '不明な話者';
  };

  const handleScrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  const handleScrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleClearTranscript = () => {
    if (confirm('文字起こしをクリアしますか？')) {
      setSegments([]);
    }
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">ライブ文字起こし</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isStreaming ? '実行中' : '停止中'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleScrollToTop}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            title="最上部にスクロール"
          >
            ↑
          </button>
          <button
            onClick={handleScrollToBottom}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            title="最下部にスクロール"
          >
            ↓
          </button>
          <button
            onClick={handleClearTranscript}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            title="文字起こしをクリア"
          >
            クリア
          </button>
        </div>
      </div>

      {/* 設定パネル */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.autoScroll}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, autoScroll: e.target.checked }))}
              className="mr-2"
            />
            自動スクロール
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.showTimestamps}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, showTimestamps: e.target.checked }))}
              className="mr-2"
            />
            タイムスタンプ表示
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.showConfidence}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, showConfidence: e.target.checked }))}
              className="mr-2"
            />
            信頼度表示
          </label>
        </div>
      </div>

      {/* 話者情報 */}
      {speakers.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">話者情報</h3>
          <div className="flex flex-wrap gap-2">
            {speakers.map((speaker) => (
              <div key={speaker.id} className="flex items-center space-x-2 px-2 py-1 bg-white rounded border">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: speaker.color }}
                ></div>
                <span className="text-sm text-gray-700">{speaker.name}</span>
                <span className="text-xs text-gray-500">({speaker.totalSegments})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文字起こし表示エリア */}
      <div
        ref={scrollContainerRef}
        className="border rounded-lg p-4 bg-gray-50"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {segments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {isStreaming ? (
              <div>
                <div className="text-lg mb-2">音声認識中...</div>
                <div className="text-sm">音声を話すと、ここに文字起こしが表示されます</div>
              </div>
            ) : (
              <div>
                <div className="text-lg mb-2">文字起こしが開始されていません</div>
                <div className="text-sm">STTストリーミングを開始してください</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                ref={index === segments.length - 1 ? lastSegmentRef : null}
                className={`p-3 rounded-lg border-l-4 transition-all duration-200 ${
                  segment.isFinal 
                    ? 'bg-white border-green-500 shadow-sm' 
                    : 'bg-yellow-50 border-yellow-400 shadow-sm'
                }`}
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {segment.speaker && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getSpeakerColor(segment.speaker) }}
                      ></div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {segment.speaker ? getSpeakerName(segment.speaker) : '不明な話者'}
                    </span>
                    {!segment.isFinal && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        仮確定
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {displaySettings.showTimestamps && (
                      <span>
                        {formatTimestamp(segment.startTime)} - {formatTimestamp(segment.endTime)}
                        <span className="ml-1">
                          ({formatDuration(segment.startTime, segment.endTime)})
                        </span>
                      </span>
                    )}
                    {displaySettings.showConfidence && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {(segment.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* テキスト */}
                <div className="text-gray-800 leading-relaxed">
                  {segment.text}
                </div>

                {/* フッター */}
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <div className="flex items-center space-x-2">
                    {segment.language && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {segment.language}
                      </span>
                    )}
                    <span>ID: {segment.id.slice(-8)}</span>
                  </div>
                  <span>
                    {new Date(segment.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 統計情報 */}
      {segments.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-700">{segments.length}</div>
              <div className="text-gray-500">セグメント数</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">
                {segments.reduce((total, segment) => total + segment.text.split(/\s+/).length, 0)}
              </div>
              <div className="text-gray-500">総単語数</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">
                {new Set(segments.map(s => s.speaker).filter(Boolean)).size}
              </div>
              <div className="text-gray-500">話者数</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">
                {segments.length > 0 
                  ? (segments.reduce((sum, segment) => sum + segment.confidence, 0) / segments.length * 100).toFixed(1)
                  : '0'
                }%
              </div>
              <div className="text-gray-500">平均信頼度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptDisplay; 

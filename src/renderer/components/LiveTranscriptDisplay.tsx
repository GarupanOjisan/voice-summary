import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranscriptionStore, useAudioStore } from '../stores';

interface LiveTranscriptDisplayProps {
  autoScroll?: boolean;
  showTimestamps?: boolean;
  showConfidence?: boolean;
  maxHeight?: string;
  refreshInterval?: number;
  showSpeakerInfo?: boolean;
  enableHighlighting?: boolean;
  wordHighlighting?: boolean;
}

const LiveTranscriptDisplay: React.FC<LiveTranscriptDisplayProps> = ({
  autoScroll = true,
  showTimestamps = true,
  showConfidence = true,
  maxHeight = '600px',
  refreshInterval = 1000,
  showSpeakerInfo = true,
  enableHighlighting = true,
  wordHighlighting = false,
}) => {
  const {
    segments,
    speakers,
    isSTTActive,
    currentSegment,
    totalWords,
    averageConfidence,
    updateStatistics,
  } = useTranscriptionStore();
  
  const { isRecording, audioLevel } = useAudioStore();
  
  const [displaySettings, setDisplaySettings] = useState({
    autoScroll,
    showTimestamps,
    showConfidence,
    showSpeakerInfo,
    enableHighlighting,
    wordHighlighting,
  });
  
  const [highlightedWords, setHighlightedWords] = useState<Set<string>>(new Set());
  const [isScrolling, setIsScrolling] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSegmentRef = useRef<HTMLDivElement>(null);
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout>();

  // 統計情報の更新
  useEffect(() => {
    updateStatistics();
  }, [segments, updateStatistics]);

  // 自動スクロール機能
  useEffect(() => {
    if (autoScroll && displaySettings.autoScroll && lastSegmentRef.current && !isScrolling) {
      // スクロールを遅延させて、新しいセグメントが完全にレンダリングされるのを待つ
      autoScrollTimeoutRef.current = setTimeout(() => {
        lastSegmentRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }, 100);
    }
    
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, [segments, autoScroll, displaySettings.autoScroll, isScrolling]);

  // 単語ハイライト機能
  useEffect(() => {
    if (wordHighlighting && currentSegment) {
      const words = currentSegment.text.split(' ');
      const newHighlightedWords = new Set(words);
      setHighlightedWords(newHighlightedWords);
      
      // 3秒後にハイライトをクリア
      const timeout = setTimeout(() => {
        setHighlightedWords(new Set());
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentSegment, wordHighlighting]);

  // スクロールイベントハンドラー
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setIsScrolling(!isAtBottom);
    }
  }, []);

  // スクロールイベントリスナーの設定
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

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
      // ストアのクリア機能を使用
      const { clearSegments } = useTranscriptionStore.getState();
      clearSegments();
    }
  };

  // 単語ハイライト機能
  const highlightWords = (text: string) => {
    if (!wordHighlighting || highlightedWords.size === 0) {
      return text;
    }
    
    const words = text.split(' ');
    return words.map((word, index) => {
      const cleanWord = word.replace(/[.,!?;:]/g, '');
      if (highlightedWords.has(cleanWord)) {
        return (
          <span key={index} className="bg-yellow-200 font-semibold">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">ライブ文字起こし</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isSTTActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isSTTActive ? '実行中' : '停止中'}
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
                <span className="text-xs text-gray-500">({speaker.id})</span>
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
            {isSTTActive ? (
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

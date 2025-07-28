import React, { useState, useEffect, useRef } from 'react';
import { useSummaryStore, useTranscriptionStore } from '../stores';

interface SummaryPanelDisplayProps {
  maxHeight?: string;
  refreshInterval?: number;
  enableAutoScroll?: boolean;
  showConfidence?: boolean;
  showUsage?: boolean;
  showProgress?: boolean;
}

const SummaryPanelDisplay: React.FC<SummaryPanelDisplayProps> = ({
  maxHeight = '600px',
  refreshInterval = 5000,
  enableAutoScroll = true,
  showConfidence = true,
  showUsage = true,
  showProgress = true,
}) => {
  const { 
    summaries, 
    actionItems, 
    isGenerating, 
    generationProgress,
    totalSummaries,
    averageConfidence,
    totalProcessingTime,
  } = useSummaryStore();
  
  const { totalWords, totalDuration } = useTranscriptionStore();
  
  const [selectedSummaryType, setSelectedSummaryType] = useState<string>('all');
  const [isScrolling, setIsScrolling] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSummaryRef = useRef<HTMLDivElement>(null);

  // 自動スクロール機能
  useEffect(() => {
    if (enableAutoScroll && lastSummaryRef.current && !isScrolling) {
      setTimeout(() => {
        lastSummaryRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }, 100);
    }
  }, [summaries, enableAutoScroll, isScrolling]);

  // スクロールイベントハンドラー
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setIsScrolling(!isAtBottom);
    }
  };

  // スクロールイベントリスナーの設定
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSummaryTypeLabel = (type: string) => {
    switch (type) {
      case 'discussion':
        return '議論要約';
      case 'topics':
        return 'トピック要約';
      case 'highlights':
        return 'ハイライト要約';
      case 'action_items':
        return 'アクションアイテム';
      default:
        return 'その他';
    }
  };

  const getSummaryTypeColor = (type: string) => {
    switch (type) {
      case 'discussion':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'topics':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'highlights':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'action_items':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
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

  const filteredSummaries = selectedSummaryType === 'all' 
    ? summaries 
    : summaries.filter(summary => summary.type === selectedSummaryType);

  return (
    <div className="h-full bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">要約パネル</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">リアルタイム生成</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">{totalSummaries}</div>
            <div className="text-gray-600">生成済み要約</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">{totalWords}</div>
            <div className="text-gray-600">総単語数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">{actionItems.length}</div>
            <div className="text-gray-600">アクションアイテム</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-orange-600">
              {averageConfidence > 0 ? `${(averageConfidence * 100).toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-gray-600">平均信頼度</div>
          </div>
        </div>
      </div>

      {/* 生成進捗 */}
      {showProgress && isGenerating && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">要約生成中...</span>
            <span className="text-sm text-blue-600">{Math.round(generationProgress)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 要約タイプフィルター */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-700">要約タイプ:</span>
          <button
            onClick={() => setSelectedSummaryType('all')}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedSummaryType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['discussion', 'topics', 'highlights', 'action_items'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedSummaryType(type)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedSummaryType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getSummaryTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* コントロールボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {filteredSummaries.length}件の要約
          </span>
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
        </div>
      </div>

      {/* 要約表示エリア */}
      <div
        ref={scrollContainerRef}
        className="border rounded-lg p-4 bg-gray-50"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {isGenerating && filteredSummaries.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <div className="text-sm text-gray-600">要約を生成中...</div>
            </div>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>要約が生成されていません</p>
            <p className="text-sm">音声認識が開始されると、自動的に要約が生成されます</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSummaries.map((summary, index) => (
              <div
                key={summary.id}
                ref={index === filteredSummaries.length - 1 ? lastSummaryRef : null}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getSummaryTypeColor(summary.type)}`}>
                      {getSummaryTypeLabel(summary.type)}
                    </span>
                    {/* showTimestamps is not defined in the original code, assuming it's meant to be true or removed */}
                    {/* {showTimestamps && (
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(summary.timestamp)}
                      </span>
                    )} */}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {showConfidence && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {(summary.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                    {showUsage && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {summary.wordCount}語
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-gray-800 leading-relaxed mb-3">
                  {summary.content}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>モデル: {summary.model}</span>
                  <span>処理時間: {summary.processingTime}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPanelDisplay; 

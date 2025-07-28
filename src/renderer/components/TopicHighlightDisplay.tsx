import React, { useState, useEffect, useRef } from 'react';
import { useSummaryStore, useTranscriptionStore } from '../stores';

interface TopicHighlightDisplayProps {
  maxHeight?: string;
  refreshInterval?: number;
  enableAutoScroll?: boolean;
  showConfidence?: boolean;
  showTimestamps?: boolean;
}

const TopicHighlightDisplay: React.FC<TopicHighlightDisplayProps> = ({
  maxHeight = '600px',
  refreshInterval = 2000,
  enableAutoScroll = true,
  showConfidence = true,
  showTimestamps = true,
}) => {
  const { topics, highlights, isGenerating } = useSummaryStore();
  const { segments } = useTranscriptionStore();
  
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [filteredHighlights, setFilteredHighlights] = useState<any[]>([]);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastHighlightRef = useRef<HTMLDivElement>(null);

  // 選択されたトピックに基づいてハイライトをフィルタリング
  useEffect(() => {
    if (selectedTopic) {
      const topic = topics.find(t => t.id === selectedTopic);
      if (topic) {
        const filtered = highlights.filter(highlight => 
          highlight.text.toLowerCase().includes(topic.name.toLowerCase()) ||
          topic.relatedTopics.some(related => 
            highlight.text.toLowerCase().includes(related.toLowerCase())
          )
        );
        setFilteredHighlights(filtered);
      }
    } else {
      setFilteredHighlights(highlights);
    }
  }, [selectedTopic, topics, highlights]);

  // 自動スクロール機能
  useEffect(() => {
    if (enableAutoScroll && lastHighlightRef.current && !isScrolling) {
      setTimeout(() => {
        lastHighlightRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }, 100);
    }
  }, [filteredHighlights, enableAutoScroll, isScrolling]);

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'action':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'decision':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'important':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'question':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'action':
        return 'アクション';
      case 'decision':
        return '決定';
      case 'important':
        return '重要';
      case 'question':
        return '質問';
      default:
        return 'その他';
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

  return (
    <div className="h-full bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">トピック別ハイライト</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">リアルタイム更新</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* トピックフィルター */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-700">トピックフィルター:</span>
          <button
            onClick={() => setSelectedTopic(null)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedTopic === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedTopic === topic.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {topic.name}
            </button>
          ))}
        </div>
      </div>

      {/* コントロールボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {filteredHighlights.length}件のハイライト
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

      {/* ハイライト表示エリア */}
      <div
        ref={scrollContainerRef}
        className="border rounded-lg p-4 bg-gray-50"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {isGenerating ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredHighlights.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">⭐</div>
            <p>ハイライトが検出されていません</p>
            <p className="text-sm">
              {selectedTopic 
                ? '選択されたトピックに関連するハイライトがありません'
                : '重要な発言や決定事項が自動的に抽出されます'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHighlights.map((highlight, index) => (
              <div
                key={highlight.id}
                ref={index === filteredHighlights.length - 1 ? lastHighlightRef : null}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-gray-900 mb-1">{highlight.text}</p>
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <span className="font-medium">{highlight.speaker}</span>
                      {showTimestamps && (
                        <span>{formatTimestamp(highlight.timestamp)}</span>
                      )}
                      {showConfidence && (
                        <span className="text-xs text-gray-500">
                          {Math.round(highlight.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(highlight.type)}`}>
                    {getTypeLabel(highlight.type)}
                  </span>
                </div>
                
                {highlight.context && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                    <span className="font-medium">コンテキスト:</span> {highlight.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicHighlightDisplay; 

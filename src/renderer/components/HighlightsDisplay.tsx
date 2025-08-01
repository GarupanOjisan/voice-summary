import React, { useState } from 'react';
import { useSummaryStore } from '../stores';

const HighlightsDisplay: React.FC = () => {
  const { highlights, isGenerating } = useSummaryStore();
  const [filter, setFilter] = useState<string>('all');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'action':
        return 'bg-green-100 text-green-800';
      case 'decision':
        return 'bg-blue-100 text-blue-800';
      case 'important':
        return 'bg-red-100 text-red-800';
      case 'question':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const filteredHighlights = filter === 'all' 
    ? highlights 
    : highlights.filter(h => h.type === filter);

  return (
    <div className="h-full bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">ハイライト</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">自動抽出</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex space-x-2 mb-4">
        {['all', 'action', 'decision', 'important', 'question'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filter === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {type === 'all' ? 'すべて' : getTypeLabel(type)}
          </button>
        ))}
      </div>

      {isGenerating ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredHighlights.map((highlight) => (
            <div
              key={highlight.id}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-gray-900 mb-1">{highlight.text}</p>
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <span className="font-medium">{highlight.speaker}</span>
                    <span>{highlight.timestamp}</span>
                    <span className="text-xs text-gray-500">
                      {Math.round(highlight.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(highlight.type)}`}>
                  {getTypeLabel(highlight.type)}
                </span>
              </div>
            </div>
          ))}
          
          {filteredHighlights.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">⭐</div>
              <p>ハイライトが検出されていません</p>
              <p className="text-sm">重要な発言や決定事項が自動的に抽出されます</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HighlightsDisplay; 

import React, { useState, useEffect } from 'react';

interface Topic {
  id: string;
  name: string;
  confidence: number;
  timestamp: string;
  duration: number;
  mentions: number;
}

const TopicsDisplay: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // サンプルデータ（実際の実装ではAPIから取得）
  useEffect(() => {
    const sampleTopics: Topic[] = [
      {
        id: '1',
        name: 'プロジェクト計画',
        confidence: 0.95,
        timestamp: '00:05:30',
        duration: 180,
        mentions: 5,
      },
      {
        id: '2',
        name: '技術的課題',
        confidence: 0.88,
        timestamp: '00:08:15',
        duration: 240,
        mentions: 3,
      },
      {
        id: '3',
        name: 'スケジュール調整',
        confidence: 0.92,
        timestamp: '00:12:45',
        duration: 120,
        mentions: 4,
      },
    ];

    setTopics(sampleTopics);
  }, []);

  return (
    <div className="h-full bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">検出されたトピック</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">自動更新</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{topic.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {topic.mentions}回言及
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(topic.confidence * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>開始時刻: {topic.timestamp}</span>
                <span>継続時間: {Math.floor(topic.duration / 60)}分{topic.duration % 60}秒</span>
              </div>
              
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${topic.confidence * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
          
          {topics.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">🏷️</div>
              <p>トピックが検出されていません</p>
              <p className="text-sm">音声認識が開始されると、自動的にトピックが抽出されます</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicsDisplay; 
